import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { UpdateNotifierComponent } from './update-notifier';
import { VersionCheckService, VersionInfo } from './../../services/ngx-update-notifier.service';
import { of, Subject } from 'rxjs';
import { By } from '@angular/platform-browser';

describe('UpdateNotifierComponent', () => {
  let component: UpdateNotifierComponent;
  let fixture: ComponentFixture<UpdateNotifierComponent>;
  let mockVersionService: jasmine.SpyObj<VersionCheckService>;
  let mockPollObservable: Subject<VersionInfo>;

  beforeEach(async () => {
    mockPollObservable = new Subject<VersionInfo>();
    mockVersionService = jasmine.createSpyObj('VersionCheckService', [
      'pollForUpdates',
      'refreshApp'
    ]);
    mockVersionService.pollForUpdates.and.returnValue(mockPollObservable.asObservable());

    await TestBed.configureTestingModule({
      imports: [UpdateNotifierComponent],
      providers: [
        { provide: VersionCheckService, useValue: mockVersionService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateNotifierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    // Clear localStorage
    localStorage.clear();
  });

  describe('Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should start polling on init', () => {
      expect(mockVersionService.pollForUpdates).toHaveBeenCalledWith(30000);
    });

    it('should stop polling on destroy', () => {
      const unsubscribeSpy = spyOn(component as any, 'subscription').and.callThrough();
      component.ngOnDestroy();
      expect(component['subscription']?.closed).toBeTrue();
    });
  });

  describe('UI Display', () => {
    it('should not show notification initially when no update', () => {
      const notificationDiv = fixture.debugElement.query(By.css('.update-notification'));
      expect(notificationDiv).toBeNull();
    });

    it('should show notification when update is available', () => {
      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true
      };

      mockPollObservable.next(versionInfo);
      fixture.detectChanges();

      const notificationDiv = fixture.debugElement.query(By.css('.update-notification'));
      expect(notificationDiv).toBeTruthy();

      const messageEl = notificationDiv.query(By.css('.update-message')).nativeElement;
      expect(messageEl.textContent).toContain('New version 2.0.0 is available!');
      expect(messageEl.textContent).toContain('Current: 1.0.0');
    });

    it('should display current version correctly', () => {
      const versionInfo: VersionInfo = {
        current: '3.1.5',
        latest: '3.2.0',
        updateAvailable: true
      };

      mockPollObservable.next(versionInfo);
      fixture.detectChanges();

      const currentVersionSpan = fixture.debugElement.query(By.css('.current-version')).nativeElement;
      expect(currentVersionSpan.textContent).toContain('3.1.5');
    });

    it('should hide notification when updateAvailable is false', () => {
      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '1.0.0',
        updateAvailable: false
      };

      mockPollObservable.next(versionInfo);
      fixture.detectChanges();

      const notificationDiv = fixture.debugElement.query(By.css('.update-notification'));
      expect(notificationDiv).toBeNull();
    });
  });

  describe('User Interactions', () => {
    it('should call refreshApp when Update Now button is clicked', () => {
      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true
      };

      mockPollObservable.next(versionInfo);
      fixture.detectChanges();

      const updateButton = fixture.debugElement.query(By.css('.update-btn')).nativeElement;
      updateButton.click();

      expect(mockVersionService.refreshApp).toHaveBeenCalled();
    });

    it('should hide notification when Dismiss button is clicked', () => {
      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true
      };

      mockPollObservable.next(versionInfo);
      fixture.detectChanges();

      expect(component.showNotification).toBeTrue();

      const dismissButton = fixture.debugElement.query(By.css('.dismiss-btn')).nativeElement;
      dismissButton.click();

      fixture.detectChanges();
      expect(component.showNotification).toBeFalse();

      const notificationDiv = fixture.debugElement.query(By.css('.update-notification'));
      expect(notificationDiv).toBeNull();
    });

    it('should store dismissed version in localStorage', () => {
      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true
      };

      mockPollObservable.next(versionInfo);
      fixture.detectChanges();

      const dismissButton = fixture.debugElement.query(By.css('.dismiss-btn')).nativeElement;
      dismissButton.click();

      const storedVersion = localStorage.getItem('ngx_update_dismissed');
      expect(storedVersion).toBe('2.0.0');
    });
  });

  describe('Dismissal Persistence', () => {
    it('should not show notification for dismissed version', () => {
      // Pre-set a dismissed version
      localStorage.setItem('ngx_update_dismissed', '2.0.0');

      // Create new component instance
      fixture = TestBed.createComponent(UpdateNotifierComponent);
      component = fixture.componentInstance;

      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true
      };

      mockPollObservable.next(versionInfo);
      fixture.detectChanges();

      const notificationDiv = fixture.debugElement.query(By.css('.update-notification'));
      expect(notificationDiv).toBeNull();
      expect(component.showNotification).toBeFalse();
    });

    it('should show notification for new version even if old version was dismissed', () => {
      localStorage.setItem('ngx_update_dismissed', '2.0.0');

      fixture = TestBed.createComponent(UpdateNotifierComponent);
      component = fixture.componentInstance;

      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '3.0.0', // Different from dismissed version
        updateAvailable: true
      };

      mockPollObservable.next(versionInfo);
      fixture.detectChanges();

      const notificationDiv = fixture.debugElement.query(By.css('.update-notification'));
      expect(notificationDiv).toBeTruthy();
    });
  });

  describe('Multiple Updates', () => {
    it('should update UI when newer version arrives after dismissal', () => {
      // First update
      const firstVersion: VersionInfo = {
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true
      };

      mockPollObservable.next(firstVersion);
      fixture.detectChanges();

      // Dismiss it
      const dismissButton = fixture.debugElement.query(By.css('.dismiss-btn')).nativeElement;
      dismissButton.click();
      fixture.detectChanges();

      expect(component.showNotification).toBeFalse();

      // Newer version arrives
      const secondVersion: VersionInfo = {
        current: '1.0.0',
        latest: '3.0.0',
        updateAvailable: true
      };

      mockPollObservable.next(secondVersion);
      fixture.detectChanges();

      const notificationDiv = fixture.debugElement.query(By.css('.update-notification'));
      expect(notificationDiv).toBeTruthy();
      expect(component.showNotification).toBeTrue();
    });

    it('should not re-show notification for same version after dismissal', () => {
      const versionInfo: VersionInfo = {
        current: '1.0.0',
        latest: '2.0.0',
        updateAvailable: true
      };

      mockPollObservable.next(versionInfo);
      fixture.detectChanges();

      const dismissButton = fixture.debugElement.query(By.css('.dismiss-btn')).nativeElement;
      dismissButton.click();
      fixture.detectChanges();

      // Emit same version again
      mockPollObservable.next(versionInfo);
      fixture.detectChanges();

      const notificationDiv = fixture.debugElement.query(By.css('.update-notification'));
      expect(notificationDiv).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from polling on component destroy', fakeAsync(() => {
      const unsubscribeSpy = spyOn(component['subscription']!, 'unsubscribe').and.callThrough();
      component.ngOnDestroy();
      expect(unsubscribeSpy).toHaveBeenCalled();
      discardPeriodicTasks();
    }));
  });
});
