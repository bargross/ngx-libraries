import { Inject, Injectable, OnDestroy, Optional, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { from, interval, Observable, of, Subject } from 'rxjs';
import { map, distinctUntilChanged, switchMap, catchError, startWith, takeUntil } from 'rxjs/operators';
import { APP_VERSION } from '../tokens/update-notifier-token';
import { VersionInfo } from '../models/version-info.model';
import { AppVersionConfig } from '../models/app-version-config.model';
import { SwUpdate } from '@angular/service-worker';

@Injectable({ providedIn: 'root' })
export class VersionCheckService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private http = inject(HttpClient);
  private appVersionConfig: AppVersionConfig; // Will be injected at build time
  private checkUrl = '/version.json'; // Static file to compare against
  private defaultInterval = 60000; // Default to 60 seconds

  public versionInfo$ = new Subject<VersionInfo>();

  public get storageKey(): string {
    return this.appVersionConfig.storageKey ?? 'ngx_update_dismissed';
  }

  constructor(
    @Inject(APP_VERSION) version: AppVersionConfig,
    @Optional() private swUpdate: SwUpdate,
  ) {
    this.appVersionConfig = version;
    this.checkUrl = version.endpointUrl ?? this.checkUrl;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public initUpdateMonitoring(): void {
    // Check if the Service Worker is enabled in the consuming app
    if (this.swUpdate?.isEnabled) {

        // Listen for version updates from the Service Worker
      this.swUpdate.versionUpdates
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        if (event.type === 'VERSION_READY') {
          const latestVersion = event.latestVersion.hash; // You can also use event.latestVersion.appData if you include version info there

          const versionInfo: VersionInfo = {
            current: this.appVersionConfig.appVersion,
            latest: latestVersion,
            updateAvailable: true
          };

          this.versionInfo$.next(versionInfo);
        }
      });

      // Your logic for PWA update flow using this.swUpdate.versionUpdates
      console.log('[ngx-update-notifier] PWA mode active. Listening for Service Worker updates.');
    } else {

      this.pollForUpdates(); // Start HTTP polling if Service Worker is not available

      // Fallback to your existing HTTP polling logic
      console.log('[ngx-update-notifier] PWA mode inactive. Falling back to HTTP polling.');
    }
  }

    /**
   * Poll for new versions at specified interval (in milliseconds)
   */
  private pollForUpdates(): void {
    let checkInterval = this.appVersionConfig.checkInterval ?? this.defaultInterval;

    interval(checkInterval).pipe(
      startWith(0), // Check immediately on subscribe
      switchMap(() => this.checkForUpdate()),
      distinctUntilChanged((prev, curr) => prev.latest === curr.latest),
      takeUntil(this.destroy$)
    ).subscribe({
      next: info => this.versionInfo$.next(info),
      error: err => console.error('[ngx-update-notifier] Error checking for updates:', err)
    });
  }

  /**
   * Single check for update
   */
  private checkForUpdate(): Observable<VersionInfo> {
    return this.http.get<{ version: string }>(this.checkUrl, { cache: 'no-store' }).pipe(
      map(response => ({
        current: this.appVersionConfig.appVersion,
        latest: response.version,
        updateAvailable: response.version !== this.appVersionConfig.appVersion
      } as VersionInfo)),
      catchError(() => of({
        current: this.appVersionConfig.appVersion,
        latest: null,
        updateAvailable: false
      } as VersionInfo))
    );
  }

  /**
   * Refresh the browser
   */
  public refreshApp(): void {
    window.location.reload();
  }
}
