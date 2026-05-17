import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { UpdateNotifierComponent } from '../components/update-notifier/update-notifier';
import { VersionCheckService } from '../services/ngx-update-notifier.service';
import { APP_VERSION } from '../tokens/update-notifier-token';

@Component({
  template: `<ngx-update-notifier />`,
  standalone: true,
  imports: [UpdateNotifierComponent]
})
class TestHostComponent {}

describe('Integration: UpdateNotifier + real service', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let httpMock: HttpTestingController;
  const versionUrl = '/version.json';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, HttpClientTestingModule],
      providers: [
        VersionCheckService,
        { provide: APP_VERSION, useValue: '1.0.0' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Clean up: destroy fixture, verify no pending HTTP, clear localStorage, and restore real timers
    fixture.destroy();
    httpMock.verify();
    localStorage.clear();
    vi.useRealTimers(); // ensure fake timers are cleaned up
  });

  it('shows notification when newer version is available', async () => {
    const req = httpMock.expectOne(versionUrl);
    req.flush({ version: '2.0.0' });

    const notification = await vi.waitFor(() => {
      const div = fixture.debugElement.query(By.css('.update-notification'));
      if (!div) throw new Error('Notification not shown');
      return div;
    });
    expect(notification.nativeElement.textContent).toContain('New version 2.0.0');
  });

  it('does not show notification when versions match', async () => {
    const req = httpMock.expectOne(versionUrl);
    req.flush({ version: '1.0.0' });

    await vi.waitFor(() => {
      const notification = fixture.debugElement.query(By.css('.update-notification'));
      expect(notification).toBeNull();
    });
  });

  it('does not show notification on network error', async () => {
    const req = httpMock.expectOne(versionUrl);
    req.error(new ErrorEvent('Network error'));

    await vi.waitFor(() => {
      const notification = fixture.debugElement.query(By.css('.update-notification'));
      expect(notification).toBeNull();
    });
  });

  it('refreshes page when Update Now is clicked', async () => {
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    const req = httpMock.expectOne(versionUrl);
    req.flush({ version: '2.0.0' });

    const updateButton = await vi.waitFor(() => {
      const btn = fixture.debugElement.query(By.css('.update-btn'));
      if (!btn) throw new Error('Update button not found');
      return btn;
    });
    updateButton.nativeElement.click();
    expect(reloadSpy).toHaveBeenCalled();
    reloadSpy.mockRestore();
  });

  it('dismisses and remembers version', async () => {
    const req = httpMock.expectOne(versionUrl);
    req.flush({ version: '2.0.0' });

    const dismissButton = await vi.waitFor(() => {
      const btn = fixture.debugElement.query(By.css('.dismiss-btn'));
      if (!btn) throw new Error('Dismiss button not found');
      return btn;
    });
    dismissButton.nativeElement.click();
    fixture.detectChanges();

    await vi.waitFor(() => {
      expect(fixture.debugElement.query(By.css('.update-notification'))).toBeNull();
    });
    expect(localStorage.getItem('ngx_update_dismissed')).toBe('2.0.0');
  });

  it('continues polling after error and shows update later', async () => {
    vi.useFakeTimers();

    // First request fails
    let req = httpMock.expectOne(versionUrl);
    req.error(new ProgressEvent('Network error'));
    await vi.advanceTimersByTimeAsync(100);

    // Wait for next poll (30s)
    await vi.advanceTimersByTimeAsync(30000);

    // Second request succeeds with newer version
    req = httpMock.expectOne(versionUrl);
    req.flush({ version: '2.0.0' });
    await vi.advanceTimersByTimeAsync(100);
    fixture.detectChanges();

    const notification = await vi.waitFor(() => {
      const div = fixture.debugElement.query(By.css('.update-notification'));
      if (!div) throw new Error('Notification not shown after retry');
      return div;
    });
    expect(notification.nativeElement.textContent).toContain('New version 2.0.0');
  });
});
