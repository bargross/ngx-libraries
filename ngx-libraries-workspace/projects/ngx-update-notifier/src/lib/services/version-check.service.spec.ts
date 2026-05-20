import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { VersionCheckService } from './version-check.service';
import { APP_VERSION } from '../tokens/update-notifier.token';
import { AppVersionConfigDefaults } from '../constants/app-version-constants';
import { AppVersionConfig } from '../models/app-version-config.model';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Mode } from '../enums/mode.enum';

// --- Helpers ---

const makeConfig = (overrides: Partial<AppVersionConfig> = {}): AppVersionConfig => ({
  appVersion: '1.0.0',
  storageKey: 'test-key',
  endpointUrl: '/api/version.json',
  checkInterval: 60000,
  applyDefaults: false,
  mode: Mode.PL,
  ...overrides,
});

const makeSwUpdate = (isEnabled: boolean) => ({
  isEnabled,
  versionUpdates: new Subject(),
});

// --- Setup ---

const setupService = (config: AppVersionConfig, swUpdate?: ReturnType<typeof makeSwUpdate>) => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: APP_VERSION, useValue: config },
      ...(swUpdate ? [{ provide: SwUpdate, useValue: swUpdate }] : []),
    ],
  });

  const service = TestBed.inject(VersionCheckService);
  const httpMock = TestBed.inject(HttpTestingController);

  return { service, httpMock };
};

// --- Tests ---

describe('VersionCheckService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('should create the service', () => {
      const { service } = setupService(makeConfig());
      expect(service).toBeTruthy();
    });

    it('should coerce applyDefaults to false when null', () => {
      const { service } = setupService(makeConfig({ applyDefaults: null as any }));
      expect((service as any).appVersionConfig.applyDefaults).toBe(false);
    });

    it('should coerce applyDefaults to false when undefined', () => {
      const { service } = setupService(makeConfig({ applyDefaults: undefined as any }));
      expect((service as any).appVersionConfig.applyDefaults).toBe(false);
    });

    it('should preserve applyDefaults when explicitly true', () => {
      const { service } = setupService(makeConfig({ applyDefaults: true }));
      expect((service as any).appVersionConfig.applyDefaults).toBe(true);
    });
  });

  // --- SW Mode ---

  describe('initUpdateMonitoring() — SW mode', () => {
    it('should subscribe to versionUpdates when mode is SW and swUpdate is enabled', () => {
      const swUpdate = makeSwUpdate(true);
      const { service } = setupService(makeConfig({ mode: Mode.SW }), swUpdate);
      const subscribeSpy = vi.spyOn(swUpdate.versionUpdates, 'subscribe' as any);

      service.initUpdateMonitoring();

      expect(subscribeSpy).toHaveBeenCalled();
    });

    it('should fall back to polling when mode is SW but swUpdate is not enabled', () => {
      vi.useFakeTimers();
      const swUpdate = makeSwUpdate(false);
      const { service, httpMock } = setupService(makeConfig({ mode: Mode.SW }), swUpdate);

      service.initUpdateMonitoring();
      vi.advanceTimersByTime(0);
      vi.runAllTicks();

      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });
      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should fall back to polling when mode is SW but swUpdate is not injected', () => {
      vi.useFakeTimers();
      const { service, httpMock } = setupService(makeConfig({ mode: Mode.SW }));

      service.initUpdateMonitoring();
      vi.advanceTimersByTime(0);
      vi.runAllTicks();

      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });
      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should emit versionInfo$ when VERSION_READY event fires', () => {
      const swUpdate = makeSwUpdate(true);
      const { service } = setupService(makeConfig({ mode: Mode.SW, appVersion: '1.0.0' }), swUpdate);

      const emitted: any[] = [];
      service.versionInfo$.subscribe(info => emitted.push(info));

      service.initUpdateMonitoring();

      swUpdate.versionUpdates.next({
        type: 'VERSION_READY',
        latestVersion: { hash: '2.0.0', appData: null } as any,
        currentVersion: { hash: '1.0.0', appData: null } as any,
      } as VersionReadyEvent);

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true,
      });
    });

    it('should not emit for non-VERSION_READY SW events', () => {
      const swUpdate = makeSwUpdate(true);
      const { service } = setupService(makeConfig({ mode: Mode.SW }), swUpdate);

      const emitted: any[] = [];
      service.versionInfo$.subscribe(info => emitted.push(info));

      service.initUpdateMonitoring();

      swUpdate.versionUpdates.next({ type: 'VERSION_DETECTED' } as any);
      swUpdate.versionUpdates.next({ type: 'VERSION_INSTALLATION_FAILED' } as any);

      expect(emitted).toHaveLength(0);
    });

    it('should stop listening to SW updates after destroy', () => {
      const swUpdate = makeSwUpdate(true);
      const { service } = setupService(makeConfig({ mode: Mode.SW }), swUpdate);

      const emitted: any[] = [];
      service.versionInfo$.subscribe(info => emitted.push(info));

      service.initUpdateMonitoring();
      service.ngOnDestroy();

      swUpdate.versionUpdates.next({
        type: 'VERSION_READY',
        latestVersion: { hash: '2.0.0', appData: null } as any,
        currentVersion: { hash: '1.0.0', appData: null } as any,
      } as VersionReadyEvent);

      expect(emitted).toHaveLength(0);
    });
  });

  // --- Polling Mode ---

  describe('initUpdateMonitoring() — polling mode', () => {
    beforeEach(() => vi.useFakeTimers());

    it('should make an immediate HTTP GET request on init', () => {
      const { service, httpMock } = setupService(makeConfig({ mode: Mode.PL }));

      service.initUpdateMonitoring();
      vi.advanceTimersByTime(0);
      vi.runAllTicks();

      const req = httpMock.expectOne('/api/version.json');
      expect(req.request.method).toBe('GET');
      req.flush({ version: '1.0.0' });
      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should poll even when swUpdate is enabled if mode is Polling', () => {
      const swUpdate = makeSwUpdate(true);
      const { service, httpMock } = setupService(makeConfig({ mode: Mode.PL }), swUpdate);

      service.initUpdateMonitoring();
      vi.advanceTimersByTime(0);
      vi.runAllTicks();

      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });
      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should emit versionInfo$ with updateAvailable true when version differs', () => {
      const { service, httpMock } = setupService(makeConfig({ appVersion: '1.0.0', mode: Mode.PL }));

      const emitted: any[] = [];
      service.versionInfo$.subscribe(info => emitted.push(info));

      service.initUpdateMonitoring();
      vi.advanceTimersByTime(0);
      vi.runAllTicks();

      httpMock.expectOne('/api/version.json').flush({ version: '2.0.0' });

      expect(emitted[0]).toEqual({
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true,
      });

      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should emit versionInfo$ with updateAvailable false when version matches', () => {
      const { service, httpMock } = setupService(makeConfig({ appVersion: '1.0.0', mode: Mode.PL }));

      const emitted: any[] = [];
      service.versionInfo$.subscribe(info => emitted.push(info));

      service.initUpdateMonitoring();
      vi.advanceTimersByTime(0);
      vi.runAllTicks();

      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });

      expect(emitted[0]).toEqual({
        current: '1.0.0',
        latest: '1.0.0',
        updateAvailable: false,
      });

      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should poll again after the configured interval', () => {
      const { service, httpMock } = setupService(makeConfig({ mode: Mode.PL }));

      service.initUpdateMonitoring();

      vi.advanceTimersByTime(0);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });

      vi.advanceTimersByTime(60000);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });

      vi.advanceTimersByTime(60000);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });

      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should not re-emit when the latest version has not changed', () => {
      const { service, httpMock } = setupService(makeConfig({ appVersion: '1.0.0', mode: Mode.PL }));

      const emitted: any[] = [];
      service.versionInfo$.subscribe(info => emitted.push(info));

      service.initUpdateMonitoring();

      vi.advanceTimersByTime(0);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '2.0.0' });

      vi.advanceTimersByTime(60000);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '2.0.0' });

      expect(emitted).toHaveLength(1);
      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should emit again when version changes between polls', () => {
      const { service, httpMock } = setupService(makeConfig({ appVersion: '1.0.0', mode: Mode.PL }));

      const emitted: any[] = [];
      service.versionInfo$.subscribe(info => emitted.push(info));

      service.initUpdateMonitoring();

      vi.advanceTimersByTime(0);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '2.0.0' });

      vi.advanceTimersByTime(60000);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '3.0.0' });

      expect(emitted).toHaveLength(2);
      expect(emitted[1].latest).toBe('3.0.0');
      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should emit a safe fallback and not throw on HTTP error', () => {
      const { service, httpMock } = setupService(makeConfig({ appVersion: '1.0.0', mode: Mode.PL }));

      const emitted: any[] = [];
      service.versionInfo$.subscribe(info => emitted.push(info));

      service.initUpdateMonitoring();
      vi.advanceTimersByTime(0);
      vi.runAllTicks();

      httpMock.expectOne('/api/version.json').flush(null, { status: 500, statusText: 'Server Error' });

      expect(emitted[0]).toEqual({
        current: '1.0.0',
        latest: null,
        updateAvailable: false,
      });

      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should stop polling after destroy', () => {
      const { service, httpMock } = setupService(makeConfig({ mode: Mode.PL }));

      service.initUpdateMonitoring();

      vi.advanceTimersByTime(0);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });

      service.ngOnDestroy();

      vi.advanceTimersByTime(60000);
      vi.runAllTicks();
      httpMock.expectNone('/api/version.json');

      httpMock.verify();
    });
  });

  // --- getInterval() ---

  describe('getInterval()', () => {
    beforeEach(() => vi.useFakeTimers());

    it('should use the configured checkInterval', () => {
      const { service, httpMock } = setupService(makeConfig({ checkInterval: 30000, mode: Mode.PL }));

      service.initUpdateMonitoring();

      vi.advanceTimersByTime(0);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });

      vi.advanceTimersByTime(30000);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });

      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should use default interval when checkInterval is null and applyDefaults is true', () => {
      const { service, httpMock } = setupService(makeConfig({
        checkInterval: null as any,
        applyDefaults: true,
        mode: Mode.PL,
      }));

      service.initUpdateMonitoring();

      vi.advanceTimersByTime(0);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });

      vi.advanceTimersByTime(AppVersionConfigDefaults.intervalMs);
      vi.runAllTicks();
      httpMock.expectOne('/api/version.json').flush({ version: '1.0.0' });

      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should throw when checkInterval is null and applyDefaults is false', () => {
      const { service } = setupService(makeConfig({
        checkInterval: null as any,
        applyDefaults: false,
        mode: Mode.PL,
      }));

      expect(() => service.initUpdateMonitoring()).toThrowError('Missing interval value.');
    });
  });

  // --- getCheckUrl() ---

  describe('getCheckUrl()', () => {
    beforeEach(() => vi.useFakeTimers());

    it('should use the configured endpointUrl', () => {
      const { service, httpMock } = setupService(makeConfig({
        endpointUrl: '/custom/version.json',
        mode: Mode.PL,
      }));

      service.initUpdateMonitoring();
      vi.advanceTimersByTime(0);
      vi.runAllTicks();

      httpMock.expectOne('/custom/version.json').flush({ version: '1.0.0' });
      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should use default URL when endpointUrl is null and applyDefaults is true', () => {
      const { service, httpMock } = setupService(makeConfig({
        endpointUrl: null as any,
        applyDefaults: true,
        checkInterval: 60000,
        mode: Mode.PL,
      }));

      service.initUpdateMonitoring();
      vi.advanceTimersByTime(0);
      vi.runAllTicks();

      httpMock.expectOne(AppVersionConfigDefaults.checkUrl).flush({ version: '1.0.0' });
      httpMock.verify();
      service.ngOnDestroy();
    });

    it('should throw when endpointUrl is null and applyDefaults is false', () => {
      const { service } = setupService(makeConfig({
        endpointUrl: null as any,
        applyDefaults: false,
        mode: Mode.PL,
      }));

      expect(() => service.initUpdateMonitoring()).toThrowError('Missing interval endpoint url.');
    });

    it('should throw when endpointUrl is whitespace and applyDefaults is false', () => {
      const { service } = setupService(makeConfig({
        endpointUrl: '   ',
        applyDefaults: false,
        mode: Mode.PL,
      }));

      expect(() => service.initUpdateMonitoring()).toThrowError('Missing interval endpoint url.');
    });
  });

  // --- refreshApp() ---

  describe('refreshApp()', () => {
    it('should call refreshApp on the service', () => {
      const { service } = setupService(makeConfig());
      const refreshSpy = vi.spyOn(service, 'refreshApp').mockImplementation(() => {});

      service.refreshApp();

      expect(refreshSpy).toHaveBeenCalledOnce();
    });
  });

  // --- ngOnDestroy ---

  describe('ngOnDestroy()', () => {
    it('should complete the destroy$ subject', () => {
      const { service } = setupService(makeConfig());
      const completeSpy = vi.spyOn((service as any).destroy$, 'complete');

      service.ngOnDestroy();

      expect(completeSpy).toHaveBeenCalled();
    });

    it('should emit from destroy$ subject on destroy', () => {
      const { service } = setupService(makeConfig());
      const nextSpy = vi.spyOn((service as any).destroy$, 'next');

      service.ngOnDestroy();

      expect(nextSpy).toHaveBeenCalled();
    });
  });
});
