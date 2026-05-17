import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VersionCheckService, VersionInfo } from '../../services/ngx-update-notifier.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'ngx-update-notifier',
  standalone: true,
  imports: [CommonModule],
  template: 'update-notifier.component.html',
  styleUrl: 'update-notifier.component.css'
})
export class UpdateNotifierComponent implements OnInit, OnDestroy {
  private versionService = inject(VersionCheckService);
  private subscription?: Subscription;
  private dismissedVersion: string | null = null;

  showNotification = false;
  versionInfo: VersionInfo | null = null;

  ngOnInit() {
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
