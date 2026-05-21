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
          paramStreams.filters$,      // <-- From ParamStreamService
          paramStreams.refreshTrigger$, // <-- From ParamStreamService
          mergedConfig
        )
      : new BehaviorSubject<number>(0);

    // Actions update the subjects created by ParamStreamService
    const actions: PaginatedActions = {
      setPage(page: number) {
        if (page < 1) return;
        paramStreams.pageNumberSubject.next(page);  // <-- Updates subject
      },

      setPageSize(size: number) {
        if (size < 1) return;
        paramStreams.pageSizeSubject.next(size);
        paramStreams.pageNumberSubject.next(1); // Reset to first page
      },

      setSort(column: string, direction: 'asc' | 'desc'){
        paramStreams.sortSubject.next({ column, direction });
        paramStreams.pageNumberSubject.next(1); // Reset to first page
      },

      setFilters(filters: Record<string, unknown>) {
        paramStreams.filtersSubject.next(filters);
        paramStreams.pageNumberSubject.next(1); // Reset to first page
      },

      refresh() {
        paramStreams.refreshTriggerSubject.next();
      },

      reset() {
        paramStreams.pageNumberSubject.next(mergedConfig.initialPage);
        paramStreams.pageSizeSubject.next(mergedConfig.initialPageSize);
        paramStreams.sortSubject.next(null);
        paramStreams.filtersSubject.next({});
        paramStreams.refreshTriggerSubject.next();
      },

      clearCache() {
        // Trigger a refresh which will bypass cache
        paramStreams.refreshTriggerSubject.next();
      }
    };

    // Return state and actions
    return {
      state: {
        data$,
        loading$: loadingSubject.asObservable(),
        error$: errorSubject.asObservable(),
        totalCount$,
        pageNumber$: paramStreams.pageNumber$,
        pageSize$: paramStreams.pageSize$,
        sortBy$: paramStreams.sort$,
        filters$: paramStreams.filters$
      },
      actions
    };
  }
}
