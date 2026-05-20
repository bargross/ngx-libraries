import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { UpdateNotifierComponent } from './update-notifier';
import { VersionCheckService } from '../../services/version-check.service';
import { APP_VERSION } from '../../tokens/update-notifier-token';
import { AppVersionConfigDefaults } from '../../constants/app-version-constants';
import { VersionInfo } from '../../models/version-info.model';
import { AppVersionConfig } from '../../models/app-version-config.model';

// --- Helpers ---

const makeVersionInfo = (overrides: Partial<VersionInfo> = {}): VersionInfo => ({
  current: '1.0.0',
  latest: '1.0.0',
  updateAvailable: false,
  ...overrides,
});

const makeConfig = (overrides: Partial<AppVersionConfig> = {}): AppVersionConfig => ({
  storageKey: 'test-version-key',
  applyDefaults: false,
  ...overrides,
} as AppVersionConfig);

// --- Setup ---

const setupComponent = async (
  config: AppVersionConfig,
  versionInfo$: BehaviorSubject<VersionInfo>
) => {
  const mockVersionService = {
    initUpdateMonitoring: vi.fn(),
    refreshApp: vi.fn(),
    versionInfo$,
  };

  await TestBed.configureTestingModule({
    imports: [UpdateNotifierComponent],
    providers: [
      { provide: VersionCheckService, useValue: mockVersionService },
      { provide: APP_VERSION, useValue: config },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<UpdateNotifierComponent> = TestBed.createComponent(UpdateNotifierComponent);
  const component = fixture.componentInstance;

  return { fixture, component, mockVersionService };
};

// --- Tests ---

describe('UpdateNotifierComponent', () => {
  let versionInfo$: BehaviorSubject<VersionInfo>;

  beforeEach(() => {
    versionInfo$ = new BehaviorSubject<VersionInfo>(makeVersionInfo());
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  // --- Initialisation ---

  describe('ngOnInit', () => {
    it('should call initUpdateMonitoring on init', async () => {
      const { fixture, mockVersionService } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      expect(mockVersionService.initUpdateMonitoring).toHaveBeenCalledOnce();
    });

    it('should read dismissed version from localStorage on init', async () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('2.0.0');

      const { fixture } = await setupComponent(makeConfig(), versionInfo$);

      fixture.detectChanges();

      expect(getItemSpy).toHaveBeenCalledWith('test-version-key');

      getItemSpy.mockRestore();
    });

    it('should show notification when update is available and version not dismissed', async () => {
      versionInfo$ = new BehaviorSubject(makeVersionInfo({ latest: '2.0.0', updateAvailable: true }));

      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      expect(component.showNotification$.value).toBe(true);
    });

    it('should not show notification when update is available but version was dismissed', async () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('2.0.0');
      versionInfo$ = new BehaviorSubject(makeVersionInfo({ latest: '2.0.0', updateAvailable: true }));

      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);

      fixture.detectChanges();

      await fixture.whenStable();

      expect(component.showNotification$.value).toBe(false);
    });

    it('should not show notification when no update is available', async () => {
      versionInfo$ = new BehaviorSubject(makeVersionInfo({ latest: '2.0.0', updateAvailable: false }));

      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      expect(component.showNotification$.value).toBe(false);
    });

    it('should react to new emissions from versionInfo$', async () => {
      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      expect(component.showNotification$.value).toBe(false);

      versionInfo$.next(makeVersionInfo({ latest: '2.0.0', updateAvailable: true }));

      expect(component.showNotification$.value).toBe(true);
    });
  });

  // --- refresh() ---

  describe('refresh()', () => {
    it('should delegate to versionService.refreshApp()', async () => {
      const { fixture, component, mockVersionService } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      component.refresh();

      expect(mockVersionService.refreshApp).toHaveBeenCalledOnce();
    });
  });

  // --- dismiss() ---

  describe('dismiss()', () => {
    it('should hide the notification', async () => {
      versionInfo$ = new BehaviorSubject(makeVersionInfo({ latest: '2.0.0', updateAvailable: true }));

      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      component.dismiss();

      expect(component.showNotification$.value).toBe(false);
    });

    it('should persist the dismissed version to localStorage', async () => {
      versionInfo$ = new BehaviorSubject(makeVersionInfo({ latest: '2.0.0', updateAvailable: true }));

      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      component.dismiss();

      expect(localStorage.getItem('test-version-key')).toBe('2.0.0');
    });

    it('should set dismissedVersion on the component', async () => {
      versionInfo$ = new BehaviorSubject(makeVersionInfo({ latest: '2.0.0', updateAvailable: true }));

      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      component.dismiss();

      expect((component as any).dismissedVersion).toBe('2.0.0');
    });

    it('should not write to localStorage if versionInfo is null', async () => {
      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      component.versionInfo$.next(null);

      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      component.dismiss();

      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should not write to localStorage if latest version is missing', async () => {
      versionInfo$ = new BehaviorSubject(makeVersionInfo({ latest: undefined as any, updateAvailable: true }));

      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      component.dismiss();

      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should not show notification again for a dismissed version when versionInfo$ re-emits', async () => {
      const info = makeVersionInfo({ latest: '2.0.0', updateAvailable: true });
      versionInfo$ = new BehaviorSubject(info);

      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      component.dismiss();
      versionInfo$.next({ ...info });

      expect(component.showNotification$.value).toBe(false);
    });
  });

  // --- getStorageKey() ---

  describe('getStorageKey()', () => {
    it('should use the configured storageKey when provided', async () => {
      const { fixture, component } = await setupComponent(makeConfig({ storageKey: 'my-key' }), versionInfo$);
      fixture.detectChanges();
      fixture.whenStable();

      expect((component as any).storageKey).toBe('my-key');
    });

    it('should use default storageKey when applyDefaults is true and no key provided', async () => {
      const { fixture, component } = await setupComponent(
        makeConfig({ storageKey: null as any, applyDefaults: true }),
        versionInfo$
      );
      fixture.detectChanges();

      expect((component as any).storageKey).toBe(AppVersionConfigDefaults.storageKey);
    });

    it('should throw when storageKey is missing and applyDefaults is false', async () => {
      const { fixture } = await setupComponent(
        makeConfig({ storageKey: null as any, applyDefaults: false }),
        versionInfo$
      );

      expect(() => fixture.detectChanges()).toThrowError('Missing storage key.');
    });

    it('should throw when applyDefaults is undefined and storageKey is missing', async () => {
      const { fixture } = await setupComponent(
        makeConfig({ storageKey: null as any, applyDefaults: undefined as any }),
        versionInfo$
      );

      expect(() => fixture.detectChanges()).toThrow('Missing storage key.');
    });
  });

  // --- ngOnDestroy ---

  describe('ngOnDestroy()', () => {
    it('should unsubscribe from versionInfo$ on destroy', async () => {
      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      fixture.destroy();

      // Emit after destroy — showNotification$ should not change
      const valueBefore = component.showNotification$.value;
      versionInfo$.next(makeVersionInfo({ latest: '99.0.0', updateAvailable: true }));

      expect(component.showNotification$.value).toBe(valueBefore);
    });

    it('should complete the destroy$ subject', async () => {
      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      const completeSpy = vi.spyOn((component as any).destroy$, 'complete');
      fixture.destroy();

      expect(completeSpy).toHaveBeenCalled();
    });
  });
});
