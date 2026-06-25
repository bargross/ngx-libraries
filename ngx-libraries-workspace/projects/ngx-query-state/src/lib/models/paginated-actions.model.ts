export interface PaginatedActions {
  setPage(page: number): void;
  setPageSize(size: number): void;
  setSort(column: string, direction: 'asc' | 'desc'): void;
  setFilters(filters: Record<string, unknown>): void;
  refresh(): void;
  reset(): void;
  clearCache(): void;
}
