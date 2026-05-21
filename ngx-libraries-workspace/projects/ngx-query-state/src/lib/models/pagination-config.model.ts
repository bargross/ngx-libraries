import { HttpRequestConfig } from "./http-request-config.model";
import { PaginationParams } from "./pagination-params.model";

export interface PaginationConfig<T = unknown> {
  // Required
  url: string;

  // Optional with defaults
  method?: 'GET' | 'POST';
  pageParam?: string;
  sizeParam?: string;
  sortParam?: string;
  filterParam?: string;
  debounceTime?: number;
  cacheTimeout?: number;
  withCredentials?: boolean;
  initialPage?: number;
  initialPageSize?: number;

  // Data mapping
  dataMapper?: (response: unknown) => T[];
  totalMapper?: (response: unknown) => number;

  // Custom request builder
  requestBuilder?: (params: PaginationParams, config: PaginationConfig) => HttpRequestConfig;
}
