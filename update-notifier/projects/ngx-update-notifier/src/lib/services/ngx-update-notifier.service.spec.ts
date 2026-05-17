import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { VersionCheckService, VersionInfo } from './version-check.service';
import { APP_VERSION } from './version.token';
import { take, firstValueFrom } from 'rxjs';

describe('VersionCheckService', () => {
  let service: VersionCheckService;
  let httpMock: HttpTestingController;
  const mockCurrentVersion = '1.0.0';
  const versionCheckUrl = '/version.json';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        VersionCheckService,
        { provide: APP_VERSION, useValue: mockCurrentVersion }
      ]
    });

    service = TestBed.inject(VersionCheckService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Ensure no outstanding requests
  });

  describe('checkForUpdate', () => {
    it('should return updateAvailable=false when versions match', async () => {
      const mockResponse = { version: '1.0.0' };

      const resultPromise = firstValueFrom(service.checkForUpdate());

      const req = httpMock.expectOne(versionCheckUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('cache')).toBe('no-store');
      req.flush(mockResponse);

      const result = await resultPromise;
      expect(result.current).toBe('1.0.0');
      expect(result.latest).toBe('1.0.0');
      expect(result.updateAvailable).toBeFalse();
    });

    it('should return updateAvailable=true when newer version exists', async () => {
      const mockResponse = { version: '2.0.0' };

      const resultPromise = firstValueFrom(service.checkForUpdate());

      const req = httpMock.expectOne(versionCheckUrl);
      req.flush(mockResponse);

      const result = await resultPromise;
      expect(result.current).toBe('1.0.0');
      expect(result.latest).toBe('2.0.0');
      expect(result.updateAvailable).toBeTrue();
    });

    it('should handle HTTP errors gracefully', async () => {
      const resultPromise = firstValueFrom(service.checkForUpdate());

      const req = httpMock.expectOne(versionCheckUrl);
      req.error(new ErrorEvent('Network error'));

      const result = await resultPromise;
      expect(result.current).toBe('1.0.0');
      expect(result.latest).toBeNull();
      expect(result.updateAvailable).toBeFalse();
    });

    it('should handle invalid response format gracefully', async () => {
      const resultPromise = firstValueFrom(service.checkForUpdate());

      const req = httpMock.expectOne(versionCheckUrl);
      req.flush({ wrongKey: '2.0.0' }); // Missing 'version' property

      const result = await resultPromise;
      expect(result.latest).toBeUndefined();
      expect(result.updateAvailable).toBeFalse();
    });

    it('should handle 404 responses gracefully', async () => {
      const resultPromise = firstValueFrom(service.checkForUpdate());

      const req = httpMock.expectOne(versionCheckUrl);
      req.flush('Not found', { status: 404, statusText: 'Not Found' });

      const result = await resultPromise;
      expect(result.latest).toBeNull();
      expect(result.updateAvailable).toBeFalse();
    });
  });

  describe('pollForUpdates', () => {
    it('should emit initial value immediately', (done) => {
      const mockResponse = { version: '1.0.0' };

      service.pollForUpdates(60000).pipe(take(1)).subscribe(result => {
        expect(result.updateAvailable).toBeFalse();
        done();
      });

      const req = httpMock.expectOne(versionCheckUrl);
      req.flush(mockResponse);
    });

    it('should emit only when version changes', (done) => {
      const responses = [
        { version: '1.0.0' },
        { version: '1.0.0' }, // Duplicate - should not emit
        { version: '2.0.0' }  // Changed - should emit
      ];

      let emitCount = 0;
      const emittedValues: VersionInfo[] = [];

      service.pollForUpdates(100).subscribe(result => {
        emitCount++;
        emittedValues.push(result);

        if (emitCount === 2) {
          expect(emittedValues[0].updateAvailable).toBeFalse();
          expect(emittedValues[1].updateAvailable).toBeTrue();
          expect(emittedValues[1].latest).toBe('2.0.0');
          done();
        }
      });

      // First request
      let req = httpMock.expectOne(versionCheckUrl);
      req.flush(responses[0]);

      // Second request (duplicate version)
      setTimeout(() => {
        req = httpMock.expectOne(versionCheckUrl);
        req.flush(responses[1]);
      }, 150);

      // Third request (new version)
      setTimeout(() => {
        req = httpMock.expectOne(versionCheckUrl);
        req.flush(responses[2]);
      }, 250);
    });

    it('should continue polling even after errors', (done) => {
      let requestCount = 0;

      service.pollForUpdates(100).pipe(take(3)).subscribe({
        next: (result) => {
          requestCount++;
          if (requestCount === 3) {
            expect(result.updateAvailable).toBeFalse();
            done();
          }
        }
      });

      // Request 1: Success
      let req = httpMock.expectOne(versionCheckUrl);
      req.flush({ version: '1.0.0' });

      // Request 2: Error
      setTimeout(() => {
        req = httpMock.expectOne(versionCheckUrl);
        req.error(new ErrorEvent('Network error'));
      }, 150);

      // Request 3: Success again
      setTimeout(() => {
        req = httpMock.expectOne(versionCheckUrl);
        req.flush({ version: '1.0.0' });
      }, 250);
    });
  });

  describe('refreshApp', () => {
    it('should call window.location.reload', () => {
      const reloadSpy = spyOn(window.location, 'reload');
      service.refreshApp();
      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});
