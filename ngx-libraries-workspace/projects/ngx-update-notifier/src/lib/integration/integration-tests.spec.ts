import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Component, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { UpdateNotifierComponent } from '../components/update-notifier/update-notifier';
import { VersionCheckService } from '../services/ngx-update-notifier.service';
import { APP_VERSION } from '../tokens/update-notifier-token';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';

@Component({
  template: `<ngx-update-notifier />`,
  standalone: true,
  imports: [UpdateNotifierComponent],
})
class TestHostComponent {}

describe('Integration: UpdateNotifierComponent + VersionCheckService', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let notifierComponent: UpdateNotifierComponent;
  let httpMock: HttpTestingController;
  let service: VersionCheckService;
  let mockSwUpdate: {
    isEnabled: boolean;
    checkForUpdate: ReturnType<typeof vi.fn>;
    versionUpdates: Subject<any>;
  };
  const versionUrl = '/version.json';
  const storageKey = 'ngx_update_dismissed';
  const appVersion = '1.0.0';
  const checkInterval = 500; // short for fast tests

  const mockConfig = {
    appVersion,
    checkInterval,
    endpointUrl: versionUrl,
    storageKey,
  };

  beforeEach(async () => {
    // Reset everything before each test
    TestBed.resetTestingModule();

    mockSwUpdate = {
      isEnabled: false,
      checkForUpdate: vi.fn().mockResolvedValue(undefined),
      versionUpdates: new Subject<any>(),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent, HttpClientTestingModule],
      providers: [
        VersionCheckService,
        { provide: APP_VERSION, useValue: mockConfig },
        { provide: SwUpdate, useValue: mockSwUpdate },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(VersionCheckService);
    fixture.detectChanges();

    // Get the child component instance
    const notifierDebugEl = fixture.debugElement.query(By.directive(UpdateNotifierComponent));
    notifierComponent = notifierDebugEl.componentInstance;
  });

  afterEach(() => {
    // Stop polling and clean up
    service.ngOnDestroy();
    fixture.destroy();
    httpMock.verify(); // This will fail if any open requests remain – which is good
    localStorage.clear();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('shows notification when a newer version is available', async () => {
    const req = httpMock.expectOne(versionUrl);
    req.flush({ version: '2.0.0' });
    fixture.detectChanges();

    const notification = await vi.waitFor(() => {
      const div = fixture.debugElement.query(By.css('.update-notification'));
      if (!div) throw new Error('Notification not found');
      return div;
    });
    expect(notification.nativeElement.textContent).toContain('New version 2.0.0');
  });

  it('does not show notification when versions match', async () => {
    const req = httpMock.expectOne(versionUrl);
    req.flush({ version: '1.0.0' });
    fixture.detectChanges();

    await vi.waitFor(() => {
      const notification = fixture.debugElement.query(By.css('.update-notification'));
      expect(notification).toBeNull();
    });
  });

  it('does not show notification on network error', async () => {
    const req = httpMock.expectOne(versionUrl);
    req.error(new ProgressEvent('Network error', { lengthComputable: false }));
    fixture.detectChanges();

    await vi.waitFor(() => {
      const notification = fixture.debugElement.query(By.css('.update-notification'));
      expect(notification).toBeNull();
    });
  });

  it('refreshes page when Update Now is clicked', async () => {
    // Mock location.reload safely
    const originalReload = window.location.reload;
    const reloadMock = vi.fn();
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      value: reloadMock,
    });

    const req = httpMock.expectOne(versionUrl);
    req.flush({ version: '2.0.0' });
    fixture.detectChanges();

    const updateButton = await vi.waitFor(() => {
      const btn = fixture.debugElement.query(By.css('.update-btn'));
      if (!btn) throw new Error('Update button not found');
      return btn;
    });

    updateButton.nativeElement.click();
    expect(reloadMock).toHaveBeenCalled();

    // Restore original reload
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      value: originalReload,
    });
  });

  it('dismisses and remembers version', async () => {
    const req = httpMock.expectOne(versionUrl);
    req.flush({ version: '2.0.0' });
    fixture.detectChanges();

    // Wait for notification to be rendered
    await vi.waitFor(() => {
      expect(notifierComponent.showNotification).toBe(true);
    });

    const dismissButton = await vi.waitFor(() => {
      const btn = fixture.debugElement.query(By.css('.dismiss-btn'));
      if (!btn) throw new Error('Dismiss button not found');
      return btn;
    });

    dismissButton.nativeElement.click();
    fixture.detectChanges();

    await vi.waitFor(() => {
      const notification = fixture.debugElement.query(By.css('.update-notification'));
      expect(notification).toBeNull();
    });

    expect(localStorage.getItem(storageKey)).toBe('2.0.0');
  });

  it('continues polling after error and shows update later', async () => {
    vi.useFakeTimers();

    // First request fails
    let req = httpMock.expectOne(versionUrl);
    req.error(new ProgressEvent('Network error', { lengthComputable: false }));
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    // No notification should appear
    let notification = fixture.debugElement.query(By.css('.update-notification'));
    expect(notification).toBeNull();

    // Advance time to trigger next poll (checkInterval = 500ms)
    await vi.advanceTimersByTimeAsync(checkInterval);

    // Second request succeeds with newer version
    req = httpMock.expectOne(versionUrl);
    req.flush({ version: '2.0.0' });
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    // Notification should now appear
    notification = await vi.waitFor(() => {
      const div = fixture.debugElement.query(By.css('.update-notification'));
      if (!div) throw new Error('Notification not shown after retry');
      return div;
    });
    expect(notification.nativeElement.textContent).toContain('New version 2.0.0');

    // Stop fake timers – afterEach will clean up
  });
});
