import { PaginationState } from "./pagination-state.model";
import { PaginatedActions } from "./paginated-actions.model";

export interface PaginatedInstance<T> {
  state: PaginationState<T>;
  actions: PaginatedActions;
}
