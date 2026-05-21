// services/param-stream.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { PaginationParams, SortConfig, FilterConfig } from '../models';

/**
 * Internal service that manages all parameter streams for a pagination instance.
 *
 * This service is responsible for:
 * - Creating BehaviorSubjects for page, size, sort, filters, and refresh trigger
 * - Combining them into a single parameter stream for the data fetcher
 * - Providing distinctUntilChanged to prevent duplicate requests
 *
 * Not intended for direct use by application code.
 */
@Injectable()
export class ParamStreamService {

  /**
   * Creates and manages all parameter streams for a pagination instance.
   *
   * @param initialPage - Starting page number (default: 1)
   * @param initialPageSize - Starting items per page (default: 10)
   * @returns Object containing individual streams and the combined parameters stream
   */
  createParameterStreams(initialPage = 1, initialPageSize = 10) {
    // Individual parameter streams (BehaviorSubjects so they can be updated)
    const pageNumberSubject = new BehaviorSubject<number>(initialPage);
    const pageSizeSubject = new BehaviorSubject<number>(initialPageSize);
    const sortSubject = new BehaviorSubject<SortConfig | null>(null);
    const filtersSubject = new BehaviorSubject<FilterConfig>({});
    const refreshTriggerSubject = new BehaviorSubject<void>(undefined);

    // Expose as observables for read-only access
    const pageNumber$ = pageNumberSubject.asObservable();
    const pageSize$ = pageSizeSubject.asObservable();
    const sort$ = sortSubject.asObservable();
    const filters$ = filtersSubject.asObservable();
    const refreshTrigger$ = refreshTriggerSubject.asObservable();

    // Combine all parameters into a single stream that emits when ANY parameter changes
    const combinedParams$ = combineLatest([
      pageNumber$,
      pageSize$,
      sort$,
      filters$,
      refreshTrigger$
    ]).pipe(
      // Transform the tuple into a single PaginationParams object
      map(([page, size, sort, filters]) => ({
        page,
        size,
        sort: sort || undefined,  // Convert null to undefined for cleaner API
        filters
      })),
      // Only emit if the parameters actually changed (prevents duplicate requests)
      distinctUntilChanged((a, b) => this.areParamsEqual(a, b))
    );

    return {
      // Subjects (for internal updates via actions)
      pageNumberSubject,
      pageSizeSubject,
      sortSubject,
      filtersSubject,
      refreshTriggerSubject,

      // Observables (for reading state)
      pageNumber$,
      pageSize$,
      sort$,
      filters$,
      refreshTrigger$,

      // Combined stream (for data fetching)
      combinedParams$
    };
  }

  /**
   * Compares two PaginationParams objects for deep equality.
   * Used by distinctUntilChanged to prevent duplicate emissions.
   */
  private areParamsEqual(a: PaginationParams, b: PaginationParams): boolean {
    // Check primitive values
    if (a.page !== b.page) return false;
    if (a.size !== b.size) return false;

    // Check sort (compare both column and direction)
    const aSort = a.sort as SortConfig;
    const bSort = b.sort as SortConfig;

    if (aSort === null && bSort === null) {
      // Both null, equal
    } else if (aSort === null || bSort === null) {
      // One null, one not - not equal
      return false;
    } else {
      // Both non-null - compare properties
      if (aSort.column !== bSort.column) return false;
      if (aSort.direction !== bSort.direction) return false;
    }

    // Check filters (deep comparison using JSON.stringify)
    return JSON.stringify(a.filters) === JSON.stringify(b.filters);
  }

  /**
   * Helper to create a standalone parameter stream for simpler use cases.
   * This is useful when you don't need full pagination state (e.g., just filters).
   */
  createSimpleParameterStream<T>(initialValue: T) {
    const subject = new BehaviorSubject<T>(initialValue);

    return {
      subject,
      value$: subject.asObservable(),
      set: (value: T) => subject.next(value),
      get: () => subject.value
    };
  }
}
