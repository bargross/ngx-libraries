import { InjectionToken } from '@angular/core';
import { AppVersionConfig } from '../models/app-version-config.model';

export const APP_VERSION = new InjectionToken<AppVersionConfig>('APP_VERSION');
