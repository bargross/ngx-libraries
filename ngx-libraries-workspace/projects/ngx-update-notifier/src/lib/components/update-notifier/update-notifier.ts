import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import { VersionInfo } from '../../models';
import { StorageService, VersionCheckService } from '../../services';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'ngx-update-notifier',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './update-notifier.html',
  styleUrl: './update-notifier.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpdateNotifierComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private versionService: VersionCheckService = inject(VersionCheckService);
  private storageService: StorageService = inject(StorageService);

  private dismissedVersion: string | null = null

  public versionInfo$ = new BehaviorSubject<VersionInfo | null>(null);
  public showNotification$ = new BehaviorSubject<boolean>(false);

  public ngOnInit() {
    this.dismissedVersion = this.storageService.getPreviousVersion();

    this.versionService.initUpdateMonitoring();

    this.versionService.versionInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe((info: VersionInfo) => {
        const currentVersionInfo = info as VersionInfo;
        const versionInfo = { ...currentVersionInfo, current: this.dismissedVersion } as VersionInfo;

        this.versionInfo$.next(versionInfo);

        this.showNotification$.next(currentVersionInfo.updateAvailable && this.dismissedVersion !== currentVersionInfo.latest);
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

      this.storageService.saveDismissedVersion(this.versionInfo$.value.latest);
    }
  }

  public ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
