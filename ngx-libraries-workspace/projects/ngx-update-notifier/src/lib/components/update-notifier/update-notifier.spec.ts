import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpdateNotifierComponent } from './update-notifier';
import { VersionCheckService } from './../../services/ngx-update-notifier.service';
import { Subject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { VersionInfo } from '../../models/version-info.model';

describe('UpdateNotifierComponent', () => {
  // Helper to create a fresh component with a new mock service
  async function createComponent() {
    const pollSubject = new Subject<VersionInfo>();
    const mockVersionService = {
      pollForUpdates: vi.fn().mockReturnValue(pollSubject.asObservable()),
      refreshApp: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [UpdateNotifierComponent],
      providers: [{ provide: VersionCheckService, useValue: mockVersionService }]
    }).compileComponents();

    const fixture = TestBed.createComponent(UpdateNotifierComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    return { fixture, component, pollSubject, mockVersionService };
  }

  afterEach(() => {
    TestBed.resetTestingModule(); // Fully reset for next test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('creates the component', async () => {
    const { component } = await createComponent();
    expect(component).toBeTruthy();
  });

  it('starts polling with 30s interval', async () => {
    const { mockVersionService } = await createComponent();
    expect(mockVersionService.pollForUpdates).toHaveBeenCalledWith(30000);
  });

  it('loads dismissed version from localStorage on init', async () => {
    localStorage.setItem('ngx_update_dismissed', '2.0.0');
    const { component } = await createComponent();
    expect(component['dismissedVersion']).toBe('2.0.0');
  });

  it('shows notification when update is available and not dismissed', async () => {
    const { fixture, pollSubject } = await createComponent();
    const versionInfo: VersionInfo = {
      current: '1.0.0',
      latest: '2.0.0',
      updateAvailable: true
    };
    pollSubject.next(versionInfo);
    fixture.detectChanges();

    const notification = await vi.waitFor(() => {
      const div = fixture.debugElement.query(By.css('.update-notification'));
      if (!div) throw new Error('Notification not shown');
      return div;
    });
    expect(notification.nativeElement.textContent).toContain('New version 2.0.0');
  });

  it('does NOT show notification when updateAvailable is false', async () => {
    const { fixture, pollSubject } = await createComponent();
    const versionInfo: VersionInfo = {
      current: '1.0.0',
      latest: '1.0.0',
      updateAvailable: false
    };
    pollSubject.next(versionInfo);
    fixture.detectChanges();

    await vi.waitFor(() => {
      const notification = fixture.debugElement.query(By.css('.update-notification'));
      expect(notification).toBeNull();
    });
  });

  it('does NOT show notification for dismissed version', async () => {
    localStorage.setItem('ngx_update_dismissed', '2.0.0');
    const { fixture, pollSubject } = await createComponent();
    const versionInfo: VersionInfo = {
      current: '1.0.0',
      latest: '2.0.0',
      updateAvailable: true
    };
    pollSubject.next(versionInfo);
    fixture.detectChanges();

    await vi.waitFor(() => {
      const notification = fixture.debugElement.query(By.css('.update-notification'));
      expect(notification).toBeNull();
    });
  });

  it('calls refreshApp when Update Now button is clicked', async () => {
    const { fixture, pollSubject, mockVersionService } = await createComponent();
    const versionInfo: VersionInfo = {
      current: '1.0.0',
      latest: '2.0.0',
      updateAvailable: true
    };
    pollSubject.next(versionInfo);
    fixture.detectChanges();

    const updateButton = await vi.waitFor(() => {
      const btn = fixture.debugElement.query(By.css('.update-btn'));
      if (!btn) throw new Error('Update button not found');
      return btn;
    });
    updateButton.nativeElement.click();
    expect(mockVersionService.refreshApp).toHaveBeenCalled();
  });

  it('dismisses notification and stores version in localStorage', async () => {
    const { fixture, pollSubject } = await createComponent();
    const versionInfo: VersionInfo = {
      current: '1.0.0',
      latest: '2.0.0',
      updateAvailable: true
    };
    pollSubject.next(versionInfo);
    fixture.detectChanges();

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
    expect(localStorage.getItem('ngx_update_dismissed')).toBe('2.0.0');
  });
});
