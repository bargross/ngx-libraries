import { Component, inject, OnInit, OnDestroy, Inject } from '@angular/core';

import { VersionCheckService } from '../../services/ngx-update-notifier.service';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { VersionInfo } from '../../models/version-info.model';
import { AppVersionConfig } from '../../models/app-version-config.model';
import { APP_VERSION } from '../../tokens/update-notifier-token';
import { isNullEmptyOrWhitespace } from '../../utils/string-is-null-or-whitespace-validator';
import { AppVersionDefaults } from '../../constants/app-version-constants';

@Component({
  selector: 'ngx-update-notifier',
  standalone: true,
  imports: [],
  template: './update-notifier.html',
  styleUrl: './update-notifier.scss'
})
export class UpdateNotifierComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private versionService = inject(VersionCheckService);
  private dismissedVersion: string | null = null
  private storageKey: string | null | undefined = null;

  public showNotification = false;
  public versionInfo: VersionInfo | null = null;

  constructor(
    @Inject(APP_VERSION) private version: AppVersionConfig,
  ) {
    if (isNullEmptyOrWhitespace(this.version.storageKey)) {
      throw Error("Storage key must be provided!");
    }
  }

  ngOnInit() {
    this.storageKey = this.version.storageKey;

    this.dismissedVersion = localStorage.getItem(this.storageKey as string);

    this.versionService.initUpdateMonitoring();

    this.versionService.versionInfo$
    .pipe(
      takeUntil(this.destroy$)
    ).subscribe(info => {
      this.versionInfo = info;

      // Show only if update available and not dismissed for this version
      this.showNotification = info.updateAvailable && this.dismissedVersion !== info.latest;
    });
  }

  refresh() {
    this.versionService.refreshApp();
  }

  dismiss() {
    this.showNotification = false;

    // Store dismissed version in localStorage
    if (this.versionInfo?.latest) {
      this.dismissedVersion = this.versionInfo.latest;
      let storageKey = this.getStorageKey();

      localStorage.setItem(storageKey, this.versionInfo.latest);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getStorageKey(): string {
    return (isNullEmptyOrWhitespace(this.version.storageKey) ?
        AppVersionDefaults.storageKey : this.version.storageKey) as string;
  }
}
