/* eslint-disable @angular-eslint/prefer-inject */
import { Inject, Injectable, OnDestroy, Optional, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Observable, of, Subject } from 'rxjs';
import { map, distinctUntilChanged, switchMap, catchError, startWith, takeUntil } from 'rxjs/operators';
import { VersionInfo, AppVersionConfig } from '../models';
import { SwUpdate } from '@angular/service-worker';
import { AppVersionConfigDefaults } from '../constants/app-version-constants';
import { isNullOrUndefined, isNullEmptyOrWhitespace } from '../utils';
import { Mode } from '../enums/mode.enum';
import { APP_VERSION } from '../tokens';

@Injectable({ providedIn: 'root' })
export class VersionCheckService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private appVersionConfig: AppVersionConfig; // Will be injected at build time

  public versionInfo$ = new Subject<VersionInfo>();

  private http = inject(HttpClient);

  constructor(
    @Inject(APP_VERSION) versionConfig: AppVersionConfig,
    @Optional() private swUpdate: SwUpdate,
  ) {
    this.appVersionConfig = versionConfig;

    if (versionConfig.applyDefaults === null || versionConfig.applyDefaults === undefined) {
      this.appVersionConfig.applyDefaults = false;
    }
  }

  public ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public initUpdateMonitoring(): void {
    // Check if the Service Worker is enabled in the consuming app
    if (this.appVersionConfig.mode === Mode.SW && this.swUpdate?.isEnabled) {

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
    const checkInterval = this.getInterval();
    const checkUrl = this.getCheckUrl();

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
    const applyDefaults = !this.appVersionConfig?.applyDefaults ? false : this.appVersionConfig?.applyDefaults;

    if (isNullOrUndefined(this.appVersionConfig.checkInterval) && applyDefaults) {
      return AppVersionConfigDefaults.intervalMs;
    }

    if (isNullOrUndefined(this.appVersionConfig.checkInterval) && !applyDefaults) {
      throw Error("Missing interval value.");
    }

    return this.appVersionConfig.checkInterval as number;
  }

  private getCheckUrl(): string {
    const applyDefaults = !this.appVersionConfig?.applyDefaults ? false : this.appVersionConfig?.applyDefaults;

    if (isNullEmptyOrWhitespace(this.appVersionConfig.endpointUrl) && applyDefaults) {
      return AppVersionConfigDefaults.checkUrl;
    }

    if (isNullEmptyOrWhitespace(this.appVersionConfig.endpointUrl) && !applyDefaults) {
      throw Error("Missing interval endpoint url.");
    }

    return this.appVersionConfig.endpointUrl as string;
  }
}
