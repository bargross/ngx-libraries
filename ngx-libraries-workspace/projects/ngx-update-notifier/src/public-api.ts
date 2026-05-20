/*
 * Public API Surface of ng-update-notifier
 */

export { VersionCheckService } from './lib/services/version-check.service';
export { UpdateNotifierComponent } from './lib/components/update-notifier/update-notifier';
export { APP_VERSION } from './lib/tokens/update-notifier-token';
export { Mode } from './lib/enums/mode.enum';

export type { AppVersionConfig, VersionInfo } from './lib/models';
