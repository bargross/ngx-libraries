import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { PaginatedHttpService } from './paginated-http.service';

describe('PaginatedHttpService', () => {
  it('should emit data when parameters change', fakeAsync(() => {
    const service = TestBed.inject(PaginatedHttpService);
    const pagination = service.create({ url: '/api/users' });

    let emittedData: unknown[] = [];
    pagination.state.data$.subscribe((data: unknown[]) => emittedData = data);

    pagination.actions.setPage(2);
    tick(300); // debounce

    const mockData = [{ id: 1 }, { id: 2 }];
    // const req = httpMock.expectOne('/api/users?page=2&size=10');
    // req.flush(mockData);

    expect(emittedData).toEqual(mockData);
  }));

  it('should reset to first page when filters change', () => {
    // Test implementation
  });

  it('should debounce rapid filter changes', fakeAsync(() => {
    // Test implementation
  }));
});
