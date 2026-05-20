// Defaults are in AppVersionDefaults

import { Mode } from "../enums/mode.enum";

export interface AppVersionConfig {
  appVersion: string; // The current version of the app, injected at build time
  checkInterval?: number; // Optional: interval in milliseconds to check for updates (default: 60000)
  endpointUrl?: string; // Optional: URL to check for version updates (default: '/version.json')
  storageKey?: string; // Optional: key for localStorage to persist version info (default: 'ngx_update_dismissed')
  applyDefaults?: boolean; // applies defaults if left as true (default value)
  mode: Mode; // mode must be included, either Sw (service worker) or Pl (polling)
}
