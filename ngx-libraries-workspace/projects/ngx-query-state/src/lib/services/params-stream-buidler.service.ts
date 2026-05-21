// param-stream.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { SortConfig, FilterConfig } from '../models';

@Injectable()
export class ParamStreamBuilderService {
  /**
   * Creates and manages all parameter streams for a pagination instance
   */
  createParameterStreams(initialPage = 1, initialPageSize = 10) {
    const pageNumber$ = new BehaviorSubject<number>(initialPage);
    const pageSize$ = new BehaviorSubject<number>(initialPageSize);
    const sort$ = new BehaviorSubject<SortConfig | null>(null);
    const filters$ = new BehaviorSubject<FilterConfig>({});
    const refreshTrigger$ = new BehaviorSubject<void>(undefined);

    // Combine all parameters into a single stream
    const combinedParams$ = combineLatest([
      pageNumber$,
      pageSize$,
      sort$,
      filters$,
      refreshTrigger$
    ]).pipe(
      map(([page, size, sort, filters]) => ({
        page,
        size,
        sort: sort || undefined,
        filters
      })),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    );

    return {
      pageNumber$,
      pageSize$,
      sort$,
      filters$,
      refreshTrigger$,
      combinedParams$
    };
  }
}
