// data-stream-builder.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  BehaviorSubject,
  combineLatest,
  of
} from 'rxjs';
import {
  switchMap,
  debounceTime,
  distinctUntilChanged,
  catchError,
  map,
  shareReplay,
  tap,
} from 'rxjs/operators';
import { PaginationConfig, PaginationParams, HttpRequestConfig } from '../models';

@Injectable()
export class DataStreamService {
  private http = inject(HttpClient);

  /**
   * Builds a complete data stream from parameter sources
   */
  buildDataStream<T>(
    params$: Observable<PaginationParams>,
    config: PaginationConfig<T>,
    loadingSubject: BehaviorSubject<boolean>,
    errorSubject: BehaviorSubject<string | null>
  ): Observable<T[]> {
    return params$.pipe(
      // Debounce rapid changes
      debounceTime(config.debounceTime || 300),

      // Only emit when params actually changed
      distinctUntilChanged((a, b) => this.areParamsEqual(a, b)),

      // Switch to HTTP request (cancels previous in-flight requests)
      switchMap(params => {
        loadingSubject.next(true);
        errorSubject.next(null);

        return this.executeHttpRequest<T>(params, config).pipe(
          tap({
            next: () => loadingSubject.next(false),
            error: (err) => {
              loadingSubject.next(false);
              errorSubject.next(err.message || 'Failed to load data');
            }
          }),
          catchError(() => {
            // Return empty array on error, error already handled above
            return of([]);
          })
        );
      }),

      // Optional caching
      // (config.cacheTimeout ? [shareReplay({
      //   bufferSize: 1,
      //   refCount: true,
      //   windowTime: config.cacheTimeout
      // })] : [])
    );
  }

  /**
   * Builds total count stream (separate from data for pagination UI)
   */
  buildTotalCountStream(
    filterParams$: Observable<Record<string, unknown>>,
    refreshTrigger$: Observable<void>,
    config: PaginationConfig
  ): Observable<number> {
    const combined$ = combineLatest([filterParams$, refreshTrigger$]).pipe(
      map(([filters]) => ({ filters })),
      debounceTime(200),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      switchMap(({ filters }) => {
        const countParams: PaginationParams = {
          page: 1,
          size: 1, // Only need 1 item to get total count
          filters
        };

        return this.executeHttpRequest<unknown>(countParams, config).pipe(
          map(response => {
            if (config.totalMapper) {
              return config.totalMapper(response);
            }

            // Fallback: try to infer from response
            if (Array.isArray(response)) return response.length;

            // if (response.total) return response.total;

            // if (response.count) return response.count;
            return 0;
          }),
          catchError(() => of(0))
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    return combined$;
  }

  /**
   * Executes the actual HTTP request
   */
  private executeHttpRequest<T>(
    params: PaginationParams,
    config: PaginationConfig<T>
  ): Observable<T[]> {
    const requestConfig = this.buildRequestConfig(params, config);

    const httpCall = requestConfig.method === 'GET'
      ? this.http.get(requestConfig.url, {
          params: requestConfig.params,
          headers: requestConfig.headers,
          withCredentials: requestConfig.withCredentials
        })
      : this.http.post(requestConfig.url, requestConfig.body, {
          headers: requestConfig.headers,
          withCredentials: requestConfig.withCredentials
        });

    return httpCall.pipe(
      map(response => {
        if (config.dataMapper) {
          return config.dataMapper(response);
        }
        // Default: assume response is the array directly
        return Array.isArray(response) ? response : [];
      })
    );
  }

  /**
   * Builds HTTP request configuration from pagination parameters
   */
  private buildRequestConfig(
    params: PaginationParams,
    config: PaginationConfig
  ): HttpRequestConfig {
    // If user provided custom request builder, use it
    if (config.requestBuilder) {
      return config.requestBuilder(params, config);
    }

    const method = config.method || 'GET';
    const pageParam = config.pageParam || 'page';
    const sizeParam = config.sizeParam || 'size';
    const sortParam = config.sortParam || 'sort';
    const filterParam = config.filterParam || 'filters';

    const queryParams: Record<string, string> = {};
    queryParams[pageParam] = params.page.toString();
    queryParams[sizeParam] = params.size.toString();

    if (params.sort) {
      const sortValue = `${params.sort.column}:${params.sort.direction}`;
      queryParams[sortParam] = sortValue;
    }

    if (params.filters && Object.keys(params.filters).length > 0) {
      if (method === 'GET') {
        // Add filters as individual query params
        Object.entries(params.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams[`${filterParam}[${key}]`] = String(value);
          }
        });
      }
    }

    const requestConfig: HttpRequestConfig = {
      method,
      url: config.url,
      params: queryParams,
      withCredentials: config.withCredentials || false
    };

    if (method === 'POST' && params.filters && Object.keys(params.filters).length > 0) {
      requestConfig.body = { filters: params.filters };
    }

    return requestConfig;
  }

  /**
   * Compares two PaginationParams objects for equality
   */
  private areParamsEqual(a: PaginationParams, b: PaginationParams): boolean {
    return a.page === b.page &&
           a.size === b.size &&
           JSON.stringify(a.sort) === JSON.stringify(b.sort) &&
           JSON.stringify(a.filters) === JSON.stringify(b.filters);
  }
}
