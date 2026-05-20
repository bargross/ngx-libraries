import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { UpdateNotifierComponent } from './update-notifier';
import { VersionCheckService } from '../../services';
import { APP_VERSION } from '../../tokens/update-notifier.token';
import { VersionInfo } from '../../models/version-info.model';
import { AppVersionConfig } from '../../models/app-version-config.model';
import { StorageService } from '../../services/storage.service';

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

  const storageServiceMock = {
    version: null as string | null,

    saveDismissedVersion(version: string) {
      this.version = version;
    },

    getPreviousVersion(): string | null {
      return this.version;
    }
  }

  await TestBed.configureTestingModule({
    imports: [UpdateNotifierComponent],
    providers: [
      { provide: VersionCheckService, useValue: mockVersionService },
      { provide: StorageService, useValue: storageServiceMock},
      { provide: APP_VERSION, useValue: config },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<UpdateNotifierComponent> = TestBed.createComponent(UpdateNotifierComponent);
  const component = fixture.componentInstance;

  return { fixture, component, mockVersionService, storageServiceMock };
};

// --- Tests ---

describe('UpdateNotifierComponent', () => {
  let versionInfo$: BehaviorSubject<VersionInfo>;

  beforeEach(() => {
    versionInfo$ = new BehaviorSubject<VersionInfo>(makeVersionInfo());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  // --- Initialisation ---

  describe('ngOnInit', () => {
    it('should call initUpdateMonitoring on init', async () => {
      const { fixture, mockVersionService } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      expect(mockVersionService.initUpdateMonitoring).toHaveBeenCalledOnce();
    });

    it('should read dismissed version from storage service on init', async () => {

      const { fixture, storageServiceMock } = await setupComponent(makeConfig(), versionInfo$);

      const getItemSpy = vi.spyOn(storageServiceMock, 'getPreviousVersion').mockReturnValue('2.0.0');

      fixture.detectChanges();

      expect(getItemSpy).toHaveBeenCalled();

      getItemSpy.mockRestore();
    });

    it('should show notification when update is available and version not dismissed', async () => {
      versionInfo$ = new BehaviorSubject(makeVersionInfo({ latest: '2.0.0', updateAvailable: true }));

      const { fixture, component } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      expect(component.showNotification$.value).toBe(true);
    });

    it('should not show notification when update is available but version was dismissed', async () => {
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

    it('should not call storage service if versionInfo is null', async () => {
      const { fixture, component, storageServiceMock } = await setupComponent(makeConfig(), versionInfo$);
      fixture.detectChanges();

      component.versionInfo$.next(null);

      const setItemSpy = vi.spyOn(storageServiceMock, 'saveDismissedVersion');

      component.dismiss();

      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should not write to localStorage if latest version is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      fixture.detectChanges();

      expect(component.showNotification$.value).toBe(false);
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completeSpy = vi.spyOn((component as any).destroy$, 'complete');
      fixture.destroy();

      expect(completeSpy).toHaveBeenCalled();
    });
  });
});
