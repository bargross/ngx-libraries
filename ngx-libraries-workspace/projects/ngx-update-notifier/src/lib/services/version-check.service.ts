import { Inject, Injectable, OnDestroy, Optional, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { from, interval, Observable, of, Subject } from 'rxjs';
import { map, distinctUntilChanged, switchMap, catchError, startWith, takeUntil } from 'rxjs/operators';
import { APP_VERSION } from '../tokens/update-notifier-token';
import { VersionInfo } from '../models/version-info.model';
import { AppVersionConfig } from '../models/app-version-config.model';
import { SwUpdate } from '@angular/service-worker';
import { AppVersionConfigDefaults } from '../constants/app-version-constants';
import { isNullOrUndefined } from '../utils/object-is-null-or-undefined-validator';
import { isNullEmptyOrWhitespace } from '../utils/string-is-null-or-whitespace-validator';

@Injectable({ providedIn: 'root' })
export class VersionCheckService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private http = inject(HttpClient);
  private appVersionConfig: AppVersionConfig; // Will be injected at build time

  public versionInfo$ = new Subject<VersionInfo>();

  constructor(
    @Inject(APP_VERSION) versionConfig: AppVersionConfig,
    @Optional() private swUpdate: SwUpdate,
  ) {
    this.appVersionConfig = versionConfig;

    if (versionConfig.applyDefaults === null || versionConfig.applyDefaults === undefined) {
      this.appVersionConfig.applyDefaults = false;
    }
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
          const latestVersion = event.latestVersion.hash;

          const versionInfo: VersionInfo = {
            current: this.appVersionConfig.appVersion,
            latest: latestVersion,
            updateAvailable: true
          };

          this.versionInfo$.next(versionInfo);
        }
      });

      console.log('[ngx-update-notifier] PWA mode active. Listening for Service Worker updates.');
    } else {

      this.pollForUpdates(); // Start HTTP polling if Service Worker is not available

      console.log('[ngx-update-notifier] PWA mode inactive. Falling back to HTTP polling.');
    }
  }

    /**
   * Refresh the browser
   */
  public refreshApp(): void {
    window.location.reload();
  }

    /**
   * Poll for new versions at specified interval (in milliseconds)
   */
  private pollForUpdates(): void {
    let checkInterval = this.getInterval();
    let checkUrl = this.getCheckUrl();

    interval(checkInterval).pipe(
      startWith(0), // Check immediately on subscribe
      switchMap(() => this.checkForUpdate(checkUrl)),
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
  private checkForUpdate(checkUrl: string): Observable<VersionInfo> {
    return this.http.get<{ version: string }>(checkUrl, { cache: 'no-store' })
    .pipe(
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

  private getInterval(): number {
    if (isNullOrUndefined(this.appVersionConfig.checkInterval) && this.appVersionConfig.applyDefaults) {
      return AppVersionConfigDefaults.intervalMs;
    }

    if (isNullOrUndefined(this.appVersionConfig.checkInterval) && this.appVersionConfig.applyDefaults === false) {
      throw Error("Missing interval value.");
    }

    return this.appVersionConfig.checkInterval as number;
  }

  private getCheckUrl(): string {
    if (isNullEmptyOrWhitespace(this.appVersionConfig.endpointUrl) && this.appVersionConfig.applyDefaults) {
      return AppVersionConfigDefaults.checkUrl;
    }

    if (isNullEmptyOrWhitespace(this.appVersionConfig.endpointUrl) && this.appVersionConfig.applyDefaults === false) {
      throw Error("Missing interval endpoint url.");
    }

    return this.appVersionConfig.endpointUrl as string;
  }
}
