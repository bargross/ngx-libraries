// services/paginated-http.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DataStreamService } from './data-stream.service';
import { ParamStreamBuilderService } from './params-stream-buidler.service';
import {
  PaginationConfig,
  PaginatedInstance,
  PaginatedActions
} from '../models';
import { PaginationState } from '../models/pagination-state.model';

@Injectable({ providedIn: 'root' })
export class PaginatedHttpService {
  private dataStreamService = inject(DataStreamService);
  private paramStreamBuilderService = inject(ParamStreamBuilderService);

  /**
   * Creates a new paginated data source instance
   */
  create<T>(config: PaginationConfig<T>): PaginatedInstance<T> {
    // Validate required config
    if (!config.url) {
      throw new Error('PaginatedHttpService: url is required in configuration');
    }

    // Merge with defaults
    const mergedConfig = {
      method: 'GET',
      pageParam: 'page',
      sizeParam: 'size',
      sortParam: 'sort',
      filterParam: 'filters',
      debounceTime: 300,
      cacheTimeout: 0,
      withCredentials: false,
      initialPage: 1,
      initialPageSize: 10,
      ...config
    } as PaginationConfig;

    // Create parameter streams
    const paramStreams = this.paramStreamBuilderService.createParameterStreams(
      mergedConfig.initialPage,
      mergedConfig.initialPageSize
    );

    // Create loading and error subjects
    const loadingSubject = new BehaviorSubject<boolean>(false);
    const errorSubject = new BehaviorSubject<string | null>(null);

    // Build data stream
    const data$ = this.dataStreamService.buildDataStream(
      paramStreams.combinedParams$,
      mergedConfig,
      loadingSubject,
      errorSubject
    );

    // Build total count stream (if totalMapper is provided)
    const totalCount$ = mergedConfig.totalMapper
      ? this.dataStreamService.buildTotalCountStream(
          paramStreams.filters$,
          paramStreams.refreshTrigger$,
          mergedConfig
        )
      : new BehaviorSubject<number>(0);

    // Expose state as observables
    const state = {
      data$,
      loading$: loadingSubject.asObservable(),
      error$: errorSubject.asObservable(),
      totalCount$,
      pageNumber$: paramStreams.pageNumber$.asObservable(),
      pageSize$: paramStreams.pageSize$.asObservable(),
      sortBy$: paramStreams.sort$.asObservable(),
      filters$: paramStreams.filters$.asObservable()
    } as PaginationState<T>;

    // Create actions
    const actions: PaginatedActions = {
      setPage(page: number) {
        if (page < 1) return;
        paramStreams.pageNumber$.next(page);
      },

      setPageSize(size: number) {
        if (size < 1) return;
        paramStreams.pageSize$.next(size);
        paramStreams.pageNumber$.next(1);
      },

      setSort(column: string, direction: 'asc' | 'desc') {
        paramStreams.sort$.next({ column, direction });
        paramStreams.pageNumber$.next(1);
      },

      setFilters(filters: Record<string, unknown>) {
        paramStreams.filters$.next(filters);
        paramStreams.pageNumber$.next(1);
      },

      refresh() {
        paramStreams.refreshTrigger$.next();
      },

      reset() {
        paramStreams.pageNumber$.next(mergedConfig.initialPage as number);
        paramStreams.pageSize$.next(mergedConfig.initialPageSize as number);
        paramStreams.sort$.next(null);
        paramStreams.filters$.next({});
        paramStreams.refreshTrigger$.next();
      },

      clearCache() {
        paramStreams.refreshTrigger$.next();
      }
    };

    return { state, actions };
  }
}
