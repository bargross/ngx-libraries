import { Observable } from "rxjs";
import { FilterConfig } from "./filter-config.model";
import { SortConfig } from "./sort-config.model";

export interface PaginationState<T> {
  /** Current page data (array of items) */
  data$: Observable<T[]>;

  /** Loading indicator (true while HTTP request is in flight) */
  loading$: Observable<boolean>;

  /** Error message if the last request failed, otherwise null */
  error$: Observable<string | null>;

  /** Total number of items across all pages (for pagination UI) */
  totalCount$: Observable<number>;

  /** Current page number (1-indexed) */
  pageNumber$: Observable<number>;

  /** Number of items per page */
  pageSize$: Observable<number>;

  /** Current sort configuration (null if no sort applied) */
  sortBy$: Observable<SortConfig | null>;

  /** Current filter configuration */
  filters$: Observable<FilterConfig>;
}
