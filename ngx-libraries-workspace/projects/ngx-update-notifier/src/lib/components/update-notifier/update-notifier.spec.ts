import { TestBed, ComponentFixture } from '@angular/core/testing';
import { UpdateNotifierComponent } from './update-notifier';
import { VersionCheckService } from './../../services/ngx-update-notifier.service';
import { Subject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { VersionInfo } from '../../models/version-info.model';

describe('UpdateNotifierComponent', () => {
  let component: UpdateNotifierComponent;
  let fixture: ComponentFixture<UpdateNotifierComponent>;
  let mockVersionService: {
    initUpdateMonitoring: ReturnType<typeof vi.fn>;
    refreshApp: ReturnType<typeof vi.fn>;
    storageKey: string;
    versionInfo$: Subject<VersionInfo>;
  };

  const mockStorageKey = 'test_storage_key';

  beforeEach(async () => {
    mockVersionService = {
      initUpdateMonitoring: vi.fn(),
      refreshApp: vi.fn(),
      storageKey: mockStorageKey,
      versionInfo$: new Subject<VersionInfo>()
    };

    await TestBed.configureTestingModule({
      imports: [UpdateNotifierComponent],
      providers: [
        { provide: VersionCheckService, useValue: mockVersionService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateNotifierComponent);
    component = fixture.componentInstance;

    // ngOnInit is called automatically after creation
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('initialization (ngOnInit)', () => {
    it('should load dismissedVersion from localStorage using service.storageKey', () => {
      const dismissedVersion = '2.0.0';
      localStorage.setItem(mockStorageKey, dismissedVersion);
      // Recreate component to trigger ngOnInit again
      fixture = TestBed.createComponent(UpdateNotifierComponent);
      component = fixture.componentInstance;

      fixture.detectChanges();

      expect(component['dismissedVersion']).toBe(dismissedVersion);
    });

    it('should call initUpdateMonitoring on the service', () => {
      expect(mockVersionService.initUpdateMonitoring).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to versionInfo$ and update versionInfo and showNotification', () => {
      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true
      };
      mockVersionService.versionInfo$.next(versionInfo);
      expect(component.versionInfo).toEqual(versionInfo);
      expect(component.showNotification).toBe(true);
    });

    it('should not show notification if updateAvailable is false', () => {
      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '1.0.0',
        updateAvailable: false
      };
      mockVersionService.versionInfo$.next(versionInfo);
      expect(component.showNotification).toBe(false);
    });

    it('should not show notification if version is dismissed', () => {
      // Pre-dismiss version 2.0.0
      localStorage.setItem(mockStorageKey, '2.0.0');
      // Recreate component to load the dismissed version
      fixture = TestBed.createComponent(UpdateNotifierComponent);
      component = fixture.componentInstance;

      fixture.detectChanges();

      // Ensure the mock service's versionInfo$ is still the same subject
      // (we need to re-assign because component instance is new)
      // For simplicity, we can re-fetch the service mock from component's injector
      // But in this test we can just use the existing mockVersionService subject
      // The new component's subscription uses the same subject reference.
      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true
      };
      mockVersionService.versionInfo$.next(versionInfo);
      expect(component.showNotification).toBe(false);
    });
  });

  describe('dismiss()', () => {
    it('should set showNotification to false and store latest version in localStorage', () => {
      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true
      };
      // First make the component receive an update
      mockVersionService.versionInfo$.next(versionInfo);

      fixture.detectChanges();

      expect(component.showNotification).toBe(true);
      expect(component.versionInfo).toEqual(versionInfo);

      component.dismiss();

      expect(component.showNotification).toBe(false);
      expect(localStorage.getItem(mockStorageKey)).toBe('2.0.0');
    });

    it('should not store anything if versionInfo.latest is null/undefined', () => {
      // Simulate error case where latest is null
      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: null,
        updateAvailable: false
      };
      mockVersionService.versionInfo$.next(versionInfo);
      component.dismiss();
      expect(localStorage.getItem(mockStorageKey)).toBeNull();
    });
  });

  describe('refresh()', () => {
    it('should call service.refreshApp', () => {
      component.refresh();
      expect(mockVersionService.refreshApp).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup (ngOnDestroy)', () => {
    it('should unsubscribe from subscription', () => {
      const unsubscribeSpy = vi.spyOn(component['subscription']!, 'unsubscribe');
      component.ngOnDestroy();
      expect(unsubscribeSpy).toHaveBeenCalled();
    });
  });
});
