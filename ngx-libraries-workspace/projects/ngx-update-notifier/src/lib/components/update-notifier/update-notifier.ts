import { Component, inject, OnInit, OnDestroy, Inject, ChangeDetectionStrategy } from '@angular/core';

import { VersionCheckService } from '../../services/version-check.service';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { VersionInfo } from '../../models/version-info.model';
import { AppVersionConfig } from '../../models/app-version-config.model';
import { APP_VERSION } from '../../tokens/update-notifier-token';
import { isNullEmptyOrWhitespace } from '../../utils/string-is-null-or-whitespace-validator';
import { AppVersionConfigDefaults } from '../../constants/app-version-constants';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ngx-update-notifier',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './update-notifier.html',
  styleUrl: './update-notifier.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateNotifierComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private versionService = inject(VersionCheckService);
  private dismissedVersion: string | null = null
  private storageKey: string = '';

  public versionInfo$ = new BehaviorSubject<VersionInfo | null>(null);
  public showNotification$ = new BehaviorSubject<boolean>(false);

  constructor(
    @Inject(APP_VERSION) private versionConfig: AppVersionConfig,
  ) { }

  public ngOnInit() {
    this.storageKey = this.getStorageKey();

    this.dismissedVersion = localStorage.getItem(this.storageKey as string);

    this.versionService.initUpdateMonitoring();

    this.versionService.versionInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(info => {
        const versionInfo = { ...info, current: this.dismissedVersion } as VersionInfo;

        this.versionInfo$.next(versionInfo);

        this.showNotification$.next(info.updateAvailable && this.dismissedVersion !== info.latest);
      });
  }

  public refresh() {
    this.dismiss();

    this.versionService.refreshApp();
  }

  public dismiss() {
    this.showNotification$.next(false);

    if (this.versionInfo$.value?.latest) {
      this.dismissedVersion = this.versionInfo$.value.latest;

      localStorage.setItem(this.storageKey as string, this.versionInfo$.value.latest);
    }
  }

  public ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }


  private getStorageKey(): string {
    let applyDefaults = this.versionConfig?.applyDefaults === null || this.versionConfig?.applyDefaults === undefined ? false : this.versionConfig?.applyDefaults;

    if (isNullEmptyOrWhitespace(this.versionConfig?.storageKey) && applyDefaults) {
      return AppVersionConfigDefaults.storageKey;
    }

    if (isNullEmptyOrWhitespace(this.versionConfig.storageKey) && !applyDefaults) {
      throw Error("Missing storage key.");
    }

    return this.versionConfig?.storageKey as string;
  }
}
