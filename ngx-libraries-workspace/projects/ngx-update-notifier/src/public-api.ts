/*
 * Public API Surface of ng-update-notifier
 */
export { UpdateNotifierComponent } from './lib/components/update-notifier/update-notifier';
export { VersionCheckService } from './lib/services';
export { APP_VERSION, LOCAL_STORAGE } from './lib/tokens';
export { Mode } from './lib/enums/mode.enum';

export type { AppVersionConfig, VersionInfo } from './lib/models';
