import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { VersionCheckService } from './ngx-update-notifier.service';
import { APP_VERSION } from '../tokens/update-notifier-token';
import { VersionInfo } from '../models/version-info.model';
import { firstValueFrom, take } from 'rxjs';

describe('VersionCheckService', () => {
  let service: VersionCheckService;
  let httpMock: HttpTestingController;
  const mockVersion = '1.0.0';
  const versionUrl = '/version.json';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VersionCheckService, { provide: APP_VERSION, useValue: mockVersion }]
    });
    service = TestBed.inject(VersionCheckService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('returns updateAvailable=false when versions match', async () => {
    const resultPromise = firstValueFrom(service.checkForUpdate());
    const req = httpMock.expectOne(versionUrl);
    req.flush({ version: '1.0.0' });

    const result = await resultPromise;
    expect(result.current).toBe('1.0.0');
    expect(result.latest).toBe('1.0.0');
    expect(result.updateAvailable).toBe(false);
  });

  it('returns updateAvailable=true when newer version exists', async () => {
    const resultPromise = firstValueFrom(service.checkForUpdate());
    const req = httpMock.expectOne(versionUrl);
    req.flush({ version: '2.0.0' });

    const result = await resultPromise;
    expect(result.updateAvailable).toBe(true);
    expect(result.latest).toBe('2.0.0');
  });

  it('handles HTTP errors gracefully', async () => {
    const resultPromise = firstValueFrom(service.checkForUpdate());
    const req = httpMock.expectOne(versionUrl);
    req.error(new ErrorEvent('Network error'));

    const result = await resultPromise;
    expect(result.latest).toBeNull();
    expect(result.updateAvailable).toBe(false);
  });

  it('handles 404 responses gracefully', async () => {
    const resultPromise = firstValueFrom(service.checkForUpdate());
    const req = httpMock.expectOne(versionUrl);
    req.flush('Not found', { status: 404, statusText: 'Not Found' });

    const result = await resultPromise;
    expect(result.latest).toBeNull();
    expect(result.updateAvailable).toBe(false);
  });

  describe('pollForUpdates', () => {
    it('emits initial value immediately', async () => {
      const firstEmission = firstValueFrom(service.pollForUpdates(60000));
      const req = httpMock.expectOne(versionUrl);
      req.flush({ version: '1.0.0' });

      const result = await firstEmission;
      expect(result.updateAvailable).toBe(false);
    });

    it('respects interval and distinctUntilChanged', async () => {
      vi.useFakeTimers();

      const emitted: VersionInfo[] = [];
      const subscription = service.pollForUpdates(1000).subscribe(v => emitted.push(v));

      // First request
      let req = httpMock.expectOne(versionUrl);
      req.flush({ version: '1.0.0' });
      await vi.advanceTimersByTimeAsync(100);
      expect(emitted.length).toBe(1);
      expect(emitted[0].updateAvailable).toBe(false);

      // Second request, same version – no emission
      await vi.advanceTimersByTimeAsync(1000);
      req = httpMock.expectOne(versionUrl);
      req.flush({ version: '1.0.0' });
      await vi.advanceTimersByTimeAsync(100);
      expect(emitted.length).toBe(1);

      // Third request, new version – emission
      await vi.advanceTimersByTimeAsync(1000);
      req = httpMock.expectOne(versionUrl);
      req.flush({ version: '2.0.0' });
      await vi.advanceTimersByTimeAsync(100);
      expect(emitted.length).toBe(2);
      expect(emitted[1].updateAvailable).toBe(true);

      subscription.unsubscribe();
      vi.useRealTimers();
    });
  });

  it('calls window.location.reload', () => {
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    service.refreshApp();
    expect(reloadSpy).toHaveBeenCalled();
    reloadSpy.mockRestore();
  });
});
