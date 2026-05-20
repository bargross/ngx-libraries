import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { APP_VERSION, Mode } from 'ngx-update-notifier';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_VERSION, useValue: { version: '1.0.0',  applyDefaults: true, checkInterval: 3000, mode: Mode.PL }
    },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
  ],
};
