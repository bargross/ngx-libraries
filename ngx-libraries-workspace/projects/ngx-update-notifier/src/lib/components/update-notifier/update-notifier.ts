import { Component, inject, OnInit, OnDestroy, Inject, ChangeDetectionStrategy } from '@angular/core';
import { BehaviorSubject, Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import { VersionInfo } from '../../models';
import { StorageService, VersionCheckService } from '../../services';

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
  private storageService = inject(StorageService);

  private dismissedVersion: string | null = null

  public versionInfo$ = new BehaviorSubject<VersionInfo | null>(null);
  public showNotification$ = new BehaviorSubject<boolean>(false);

  constructor() { }

  public ngOnInit() {
    this.dismissedVersion = this.storageService.getPreviousVersion();

    this.versionService.initUpdateMonitoring();

    this.versionService.versionInfo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(info => {
        let currentVersionInfo = info as VersionInfo;
        const versionInfo = { ...currentVersionInfo, current: this.dismissedVersion } as VersionInfo;

        this.versionInfo$.next(versionInfo);

        let isNotSameVersion = this.dismissedVersion !== currentVersionInfo.latest;
        console.log(this.dismissedVersion, currentVersionInfo.latest, isNotSameVersion);

        this.showNotification$.next(currentVersionInfo.updateAvailable && isNotSameVersion);
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
