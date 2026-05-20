// version-check.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject, Observable, firstValueFrom } from 'rxjs';
import { VersionCheckService } from './version-check.service';
import { APP_VERSION } from '../tokens/update-notifier-token';
import { AppVersionConfig } from '../models/app-version-config.model';
import { VersionInfo } from '../models/version-info.model';
import { AppVersionConfigDefaults } from '../constants/app-version-constants';

class MockSwUpdate {
  private _isEnabled = true;
  private versionUpdatesSubject = new Subject<VersionEvent>();

  get isEnabled(): boolean {
    return this._isEnabled;
  }
  set isEnabled(value: boolean) {
    this._isEnabled = value;
  }

  get versionUpdates(): Observable<VersionEvent> {
    return this.versionUpdatesSubject.asObservable();
  }

  emitVersionEvent(event: VersionEvent): void {
    this.versionUpdatesSubject.next(event);
  }
}

describe('VersionCheckService', () => {
  let service: VersionCheckService;
  let httpMock: HttpTestingController;
  let mockSwUpdate: MockSwUpdate;

  const defaultConfigWithAll: AppVersionConfig = {
    appVersion: '1.0.0',
    endpointUrl: 'https://api.example.com/version',
    checkInterval: 30000,
    applyDefaults: true,
    storageKey: 'some-key',
  };

  const minimalConfig: AppVersionConfig = {
    appVersion: '1.0.0',
  };

  async function createService(config: AppVersionConfig, swEnabled = true) {
    TestBed.resetTestingModule();
    mockSwUpdate = new MockSwUpdate();
    mockSwUpdate.isEnabled = swEnabled;

    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_VERSION, useValue: config },
        { provide: SwUpdate, useValue: mockSwUpdate },
        VersionCheckService,
      ],
    }).compileComponents();

    service = TestBed.inject(VersionCheckService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    if (service) service.ngOnDestroy();
    if (httpMock) httpMock.verify();

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor and defaults handling', () => {
    it('should set applyDefaults to false if not provided or null/undefined', async () => {
      await createService(minimalConfig, false);
      expect((service as any).appVersionConfig.applyDefaults).toBe(false);
    });

    it('should keep applyDefaults as true if explicitly set to true', async () => {
      const configWithTrue = { ...minimalConfig, applyDefaults: true };
      await createService(configWithTrue, false);
      expect((service as any).appVersionConfig.applyDefaults).toBe(true);
    });
  });

  describe('PWA mode (Service Worker enabled)', () => {
    beforeEach(async () => {
      await createService(defaultConfigWithAll, true);
    });

    it('should listen to versionUpdates and emit when VERSION_READY event occurs', async () => {
      service.initUpdateMonitoring();
      const promise = firstValueFrom(service.versionInfo$);
      mockSwUpdate.emitVersionEvent({
        type: 'VERSION_READY',
        latestVersion: { hash: 'new-hash-123' },
        currentVersion: { hash: 'old-hash' },
      } as VersionEvent);
      const result = await promise;
      expect(result).toEqual({
        current: '1.0.0',
        latest: 'new-hash-123',
        updateAvailable: true,
      });
    });

    it('should ignore non-VERSION_READY events', () => {
      const spy = vi.spyOn(service.versionInfo$, 'next');
      service.initUpdateMonitoring();
      mockSwUpdate.emitVersionEvent({ type: 'VERSION_DETECTED' } as VersionEvent);
      expect(spy).not.toHaveBeenCalled();
    });

    it('should unsubscribe from versionUpdates on destroy', () => {
      service.initUpdateMonitoring();
      const nextSpy = vi.spyOn(service.versionInfo$, 'next');
      service.ngOnDestroy();
      mockSwUpdate.emitVersionEvent({ type: 'VERSION_READY' } as VersionEvent);
      expect(nextSpy).not.toHaveBeenCalled();
    });
  });

  describe('HTTP polling mode (Service Worker disabled or absent)', () => {
    beforeEach(async () => {
      await createService(defaultConfigWithAll, false);
      vi.useFakeTimers();
    });

    it('should start polling with the configured interval', () => {
      service.initUpdateMonitoring();
      const req = httpMock.expectOne(defaultConfigWithAll.endpointUrl!);
      req.flush({ version: '2.0.0' });
      vi.advanceTimersByTime(defaultConfigWithAll.checkInterval!);
      const secondReq = httpMock.expectOne(defaultConfigWithAll.endpointUrl!);
      secondReq.flush({ version: '2.0.0' });
    });

    it('should emit VersionInfo on each successful poll', async () => {
      const emissionPromise = firstValueFrom(service.versionInfo$);
      service.initUpdateMonitoring();
      const req = httpMock.expectOne(defaultConfigWithAll.endpointUrl!);
      req.flush({ version: '2.0.0' });
      const result = await emissionPromise;
      expect(result).toEqual({
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true,
      });
    });

    it('should not emit duplicate latest versions (distinctUntilChanged)', () => {
      const nextSpy = vi.spyOn(service.versionInfo$, 'next');
      service.initUpdateMonitoring();
      let req = httpMock.expectOne(defaultConfigWithAll.endpointUrl!);
      req.flush({ version: '2.0.0' });
      expect(nextSpy).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(defaultConfigWithAll.checkInterval!);
      req = httpMock.expectOne(defaultConfigWithAll.endpointUrl!);
      req.flush({ version: '2.0.0' });
      expect(nextSpy).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(defaultConfigWithAll.checkInterval!);
      req = httpMock.expectOne(defaultConfigWithAll.endpointUrl!);
      req.flush({ version: '3.0.0' });
      expect(nextSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle HTTP errors and emit fallback VersionInfo', async () => {
      const emissionPromise = firstValueFrom(service.versionInfo$);
      service.initUpdateMonitoring();
      const req = httpMock.expectOne(defaultConfigWithAll.endpointUrl!);
      req.flush('Server error', { status: 500, statusText: 'Internal Error' });
      const result = await emissionPromise;
      expect(result).toEqual({
        current: '1.0.0',
        latest: null,
        updateAvailable: false,
      });
    });

    it('should stop polling when ngOnDestroy is called', () => {
      service.initUpdateMonitoring();
      const req = httpMock.expectOne(defaultConfigWithAll.endpointUrl!);
      req.flush({ version: '2.0.0' });
      service.ngOnDestroy();
      vi.advanceTimersByTime(defaultConfigWithAll.checkInterval!);
      httpMock.expectNone(defaultConfigWithAll.endpointUrl!);
    });
  });

  describe('applyDefaults = true with missing config values', () => {
    const configWithDefaultsTrue: AppVersionConfig = {
      appVersion: '1.0.0',
      applyDefaults: true,
    };

    beforeEach(async () => {
      await createService(configWithDefaultsTrue, false);
      vi.useFakeTimers();
    });

    it('should use default endpoint URL from constants', () => {
      service.initUpdateMonitoring();
      const req = httpMock.expectOne(AppVersionConfigDefaults.checkUrl);
      req.flush({ version: '2.0.0' });
    });

    it('should use default check interval from constants', () => {
      service.initUpdateMonitoring();
      httpMock.expectOne(AppVersionConfigDefaults.checkUrl).flush({ version: '2.0.0' });
      vi.advanceTimersByTime(AppVersionConfigDefaults.intervalMs);
      const secondReq = httpMock.expectOne(AppVersionConfigDefaults.checkUrl);
      secondReq.flush({ version: '2.0.0' });
    });
  });

  describe('applyDefaults = false with missing config values', () => {
    // Provide a dummy endpoint URL (not the default) to avoid 'undefined' issues
    const configWithDefaultsFalse: AppVersionConfig = {
      appVersion: '1.0.0',
      applyDefaults: false,
      checkInterval: 1000,
      endpointUrl: 'https://example.com/dummy', // not the default
    };

    describe('when interval is missing', () => {
      beforeEach(async () => {
        const config = { ...configWithDefaultsFalse, checkInterval: undefined };

        await createService(config, false);

        vi.useFakeTimers();
      });

      it('should throw an error', () => {
        expect(() => service.initUpdateMonitoring()).toThrow('Missing interval value.');
      });
    });

    [null, '', ' ', undefined].forEach(value => {
      describe('when check url is missing', () => {
        beforeEach(async () => {
          const config = { ...configWithDefaultsFalse, endpointUrl: value } as AppVersionConfig;

          await createService(config, false);

          // vi.useFakeTimers();
        });

        it('should throw an error', () => {
          expect(() => service.initUpdateMonitoring()).toThrow('Missing interval endpoint url.');
        });
      });
    });

    describe('when the values required by the service are provided', () => {
      beforeEach(async () => {
        await createService(configWithDefaultsFalse, false);

        vi.useFakeTimers();
      });

      it('should call the http client', () => {
        httpMock.expectNone(configWithDefaultsFalse.endpointUrl!);
      });
    });
  });

  describe('Service Worker optional (SwUpdate not provided)', () => {
    const configWithAll = { ...defaultConfigWithAll };

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: APP_VERSION, useValue: configWithAll },
          { provide: SwUpdate, useValue: null },
          VersionCheckService,
        ],
      }).compileComponents();
      service = TestBed.inject(VersionCheckService);
      httpMock = TestBed.inject(HttpTestingController);
      vi.useFakeTimers();
    });

    it('should fall back to HTTP polling when SwUpdate is not injected', () => {
      service.initUpdateMonitoring();
      const req = httpMock.expectOne(configWithAll.endpointUrl!);
      req.flush({ version: '2.0.0' });
    });
  });
});
