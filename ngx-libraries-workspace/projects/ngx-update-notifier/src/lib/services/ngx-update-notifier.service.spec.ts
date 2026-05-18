import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { VersionCheckService } from './ngx-update-notifier.service';
import { APP_VERSION } from '../tokens/update-notifier-token';
import { AppVersionConfig } from '../models/app-version-config.model';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { fakeAsync, tick } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

describe('VersionCheckService', () => {
  let service: VersionCheckService;
  let httpMock: HttpTestingController;
  let mockSwUpdate: {
    isEnabled: boolean;
    checkForUpdate: ReturnType<typeof vi.fn>;
    versionUpdates: Subject<any>;
  };
  const defaultConfig: AppVersionConfig = {
    appVersion: '1.0.0',
    checkInterval: 60000,
    endpointUrl: '/version.json',
    storageKey: 'custom_storage_key'
  };

  function createService(swEnabled: boolean = false, config: AppVersionConfig = defaultConfig) {
    mockSwUpdate = {
      isEnabled: swEnabled,
      checkForUpdate: vi.fn().mockResolvedValue(undefined),
      versionUpdates: new Subject<any>()
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        VersionCheckService,
        { provide: APP_VERSION, useValue: config },
        { provide: SwUpdate, useValue: mockSwUpdate }
      ]
    });

    service = TestBed.inject(VersionCheckService);
    httpMock = TestBed.inject(HttpTestingController);
    return service;
  }

  afterEach(() => {
    httpMock.verify();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('constructor & configuration', () => {
    it('should use provided config values', () => {
      const customConfig: AppVersionConfig = {
        appVersion: '2.0.0',
        checkInterval: 30000,
        endpointUrl: '/custom-version.json',
        storageKey: 'my_key'
      };

      createService(false, customConfig);

      expect(service['appVersionConfig']).toEqual(customConfig);
    });

    it('should use default values when config omits optional fields', () => {
      const minimalConfig: AppVersionConfig = { appVersion: '1.0.0', checkInterval: 60000, endpointUrl: '/custom-version.json', storageKey: '' };

      createService(false, minimalConfig);
    });
  });

  describe('initUpdateMonitoring - PWA mode (SwUpdate enabled)', () => {
    beforeEach(() => {
      createService(true);

      service.initUpdateMonitoring();
    });

    it('should call SwUpdate.checkForUpdate on init', () => {
      expect(mockSwUpdate.checkForUpdate).toHaveBeenCalledTimes(1);
    });

    it('should emit VERSION_READY event as versionInfo', async () => {
      // Subscribe to versionInfo$ and take the first emission
      const versionPromise = firstValueFrom(service.versionInfo$);

      // Simulate checkForUpdate resolving (it's a promise)
      await vi.waitFor(() => {
        expect(mockSwUpdate.checkForUpdate).toHaveBeenCalled();
      });

      const readyEvent: VersionReadyEvent = {
        type: 'VERSION_READY',
        currentVersion: { hash: 'oldhash' },
        latestVersion: { hash: 'abc123hash' }
      };
      mockSwUpdate.versionUpdates.next(readyEvent);

      const info = await versionPromise;
      expect(info.current).toBe('1.0.0');
      expect(info.latest).toBe('abc123hash');
      expect(info.updateAvailable).toBe(true);
    });

    it('should NOT start HTTP polling when SwUpdate is enabled', () => {
      httpMock.expectNone('/version.json');
    });

    it('should not emit for other versionUpdates event types', async () => {
      // Spy on versionInfo$ next
      const nextSpy = vi.spyOn(service.versionInfo$, 'next');

      await vi.waitFor(() => {
        expect(mockSwUpdate.checkForUpdate).toHaveBeenCalled();
      });

      mockSwUpdate.versionUpdates.next({ type: 'VERSION_DETECTED' });

      expect(nextSpy).not.toHaveBeenCalled();
    });
  });

  describe('initUpdateMonitoring - fallback to HTTP polling', () => {
    beforeEach(() => {
      createService(false);

      service.initUpdateMonitoring();
    });

    it('should start polling when SwUpdate is disabled', fakeAsync(() => {
      // Immediate first request (startWith(0))
      let req = httpMock.expectOne('/version.json');
      req.flush({ version: '1.0.0' });
      tick(100);

      // Advance to next poll interval
      tick(defaultConfig.checkInterval!);

      req = httpMock.expectOne('/version.json');
      req.flush({ version: '2.0.0' });

      tick(100);

      httpMock.verify();
    }));

    it('should emit versionInfo when update is available via polling', async () => {
      const versionPromise = firstValueFrom(service.versionInfo$);

      const req = httpMock.expectOne('/version.json');
      req.flush({ version: '2.0.0' });

      const info = await versionPromise;
      expect(info.current).toBe('1.0.0');
      expect(info.latest).toBe('2.0.0');
      expect(info.updateAvailable).toBe(true);
    });

    it('should handle HTTP errors gracefully in polling mode', async () => {
      const versionPromise = firstValueFrom(service.versionInfo$);

      const req = httpMock.expectOne('/version.json');
      req.error(new ErrorEvent('Network error'));

      const info = await versionPromise;
      expect(info.current).toBe('1.0.0');
      expect(info.latest).toBeNull();
      expect(info.updateAvailable).toBe(false);
    });

    it('should not emit duplicate versions due to distinctUntilChanged', fakeAsync(() => {
      const emitted: any[] = [];
      service.versionInfo$.subscribe(info => emitted.push(info));

      // First request
      let req = httpMock.expectOne('/version.json');
      req.flush({ version: '1.0.0' });
      tick(100);

      // Advance to next poll (same version)
      tick(defaultConfig.checkInterval!);
      req = httpMock.expectOne('/version.json');
      req.flush({ version: '1.0.0' });
      tick(100);

      expect(emitted.length).toBe(1);
      expect(emitted[0].updateAvailable).toBe(false);
    }));

    it('should stop polling on ngOnDestroy', fakeAsync(() => {
      let req = httpMock.expectOne('/version.json');
      req.flush({ version: '1.0.0' });
      tick(100);

      service.ngOnDestroy();

      tick(defaultConfig.checkInterval!);
      httpMock.expectNone('/version.json');
    }));
  });

  describe('refreshApp', () => {
    let reloadSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      createService(false);

      reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

      service.refreshApp();
    });

    it('should reload the page', () => {
      expect(reloadSpy).toHaveBeenCalled();
      reloadSpy.mockRestore();
    });
  });

  describe('polling interval configuration', () => {
    it('uses config.checkInterval when provided', fakeAsync(() => {
      const customInterval = 10000;
      const config = { appVersion: '1.0.0', checkInterval: customInterval };
      createService(false, config);
      service.initUpdateMonitoring();

      // First request immediate
      let req = httpMock.expectOne('/version.json');
      req.flush({ version: '1.0.0' });
      tick(100);

      tick(customInterval - 50);
      httpMock.expectNone('/version.json');

      tick(50);
      req = httpMock.expectOne('/version.json');
      req.flush({ version: '1.0.0' });
    }));
  });
});
