// services/paginated-http.service.ts (excerpt showing integration)
import { Injectable, inject } from '@angular/core';
import { PaginationConfig, PaginatedInstance, PaginatedActions } from '../models';
import { DataStreamBuilderService } from './data-stream-builder.service';
import { ParamStreamService } from './params-stream.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PaginatedHttpService {
  private dataStreamBuilder = inject(DataStreamBuilderService);
  private paramStreamService = inject(ParamStreamService);

  create<T>(config: PaginationConfig<T>): PaginatedInstance<T> {
    // Merge defaults
    const mergedConfig = {
      initialPage: 1,
      initialPageSize: 10,
      ...config
    };

    // Create parameter streams using ParamStreamService
    const paramStreams = this.paramStreamService.createParameterStreams(
      mergedConfig.initialPage,
      mergedConfig.initialPageSize
    );

    // Create loading/error subjects
    const loadingSubject = new BehaviorSubject<boolean>(false);
    const errorSubject = new BehaviorSubject<string | null>(null);

    // Build data stream using the combined parameters
    const data$ = this.dataStreamBuilder.buildDataStream(
      paramStreams.combinedParams$,  // <-- From ParamStreamService
      mergedConfig,
      loadingSubject,
      errorSubject
    );

    // Build total count stream (uses filters from paramStreams)
    const totalCount$ = mergedConfig.totalMapper
      ? this.dataStreamBuilder.buildTotalCountStream(
          paramStreams.readOnly.filters$,      // <-- From ParamStreamService
          paramStreams.readOnly.refreshTrigger$, // <-- From ParamStreamService
          mergedConfig
        )
      : new BehaviorSubject<number>(0);

    const state = {
      data$,
      loading$: loadingSubject.asObservable(),
      error$: errorSubject.asObservable(),
      totalCount$,
      pageNumber$: paramStreams.readOnly.pageNumber$,
      pageSize$: paramStreams.readOnly.pageSize$,
      sortBy$: paramStreams.readOnly.sort$,
      filters$: paramStreams.readOnly.filters$
    };

    // Actions update the subjects created by ParamStreamService
    const actions: PaginatedActions = {
      setPage(page: number) {
        if (page < 1) throw Error(`Invalid page number ${page}`);

        paramStreams.internal.pageNumberSubject.next(page);  // <-- Updates subject
      },

      setPageSize(size: number) {
        if (size < 1) throw Error(`Invalid page size ${size}`);

        paramStreams.internal.pageSizeSubject.next(size);
        paramStreams.internal.pageNumberSubject.next(1); // Reset to first page
      },

      setSort(column: string, order: 'asc' | 'desc'){
        paramStreams.internal.sortSubject.next({ column, order });
        paramStreams.internal.pageNumberSubject.next(1); // Reset to first page
      },

      setFilters(filters: Record<string, unknown>) {
        paramStreams.internal.filtersSubject.next(filters);
        paramStreams.internal.pageNumberSubject.next(1); // Reset to first page
      },

      refresh() {
        paramStreams.internal.refreshTriggerSubject.next();
      },

      reset() {
        paramStreams.internal.pageNumberSubject.next(mergedConfig.initialPage);
        paramStreams.internal.pageSizeSubject.next(mergedConfig.initialPageSize);
        paramStreams.internal.sortSubject.next(null);
        paramStreams.internal.filtersSubject.next({});
        paramStreams.internal.refreshTriggerSubject.next();
      },

      clearCache() {
        // Trigger a refresh which will bypass cache
        paramStreams.internal.refreshTriggerSubject.next();
      }
    } as PaginatedActions;

    // Return state and actions
    return { state, actions };
  }
}
