import { SortConfig } from "./sort-config.model";

export interface PaginationParams {
  page: number;
  size: number;
  sort?: SortConfig;
  filters?: Record<string, unknown>;
}
