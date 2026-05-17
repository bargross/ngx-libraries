import { Inject, Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Observable, of } from 'rxjs';
import { map, distinctUntilChanged, switchMap, catchError, startWith } from 'rxjs/operators';
import { APP_VERSION } from '../tokens/update-notifier-token';
import { VersionInfo } from '../models/version-info.model';

@Injectable({ providedIn: 'root' })
export class VersionCheckService {
  private http = inject(HttpClient);
  private currentVersion: string; // Will be injected at build time
  private checkUrl = '/version.json'; // Static file to compare against

  constructor(@Inject(APP_VERSION) version: string) {
    this.currentVersion = version;
  }

  /**
   * Poll for new versions at specified interval (in milliseconds)
   */
  public pollForUpdates(intervalMs: number = 60000): Observable<VersionInfo> {
    return interval(intervalMs).pipe(
      startWith(0), // Check immediately on subscribe
      switchMap(() => this.checkForUpdate()),
      distinctUntilChanged((prev, curr) => prev.latest === curr.latest)
    );
  }

  /**
   * Single check for update
   */
  public checkForUpdate(): Observable<VersionInfo> {
    return this.http.get<{ version: string }>(this.checkUrl, { cache: 'no-store' }).pipe(
      map(response => ({
        current: this.currentVersion,
        latest: response.version,
        updateAvailable: response.version !== this.currentVersion
      } as VersionInfo)),
      catchError(() => of({
        current: this.currentVersion,
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
