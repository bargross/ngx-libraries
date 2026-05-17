import { Component, inject, OnInit, OnDestroy } from '@angular/core';

import { VersionCheckService } from '../../services/ngx-update-notifier.service';
import { Subscription } from 'rxjs';
import { VersionInfo } from '../../models/version-info.model';

@Component({
  selector: 'ngx-update-notifier',
  standalone: true,
  imports: [],
  template: './update-notifier.html',
  styleUrl: './update-notifier.scss'
})
export class UpdateNotifierComponent implements OnInit, OnDestroy {
  private versionService = inject(VersionCheckService);
  private subscription?: Subscription;
  private dismissedVersion: string | null = null;

  public showNotification = false;
  public versionInfo: VersionInfo | null = null;

  ngOnInit() {
    this.dismissedVersion = localStorage.getItem('ngx_update_dismissed');

    // Check every 30 seconds
    this.subscription = this.versionService.pollForUpdates(30000).subscribe(info => {
      this.versionInfo = info;

      // Show only if update available and not dismissed for this version
      this.showNotification = info.updateAvailable &&
                               this.dismissedVersion !== info.latest;
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
      localStorage.setItem('ngx_update_dismissed', this.versionInfo.latest);
    }
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
