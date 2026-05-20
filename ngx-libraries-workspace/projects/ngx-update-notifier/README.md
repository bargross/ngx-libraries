# ngx-update-notifier

A lightweight, zero‑dependency Angular library that automatically detects new versions of your application and prompts users to refresh the UI.

---

## ✨ Features

- **Smart detection** – choose between **HTTP polling** or **Service Worker** monitoring.
- **No Service Worker required** – falls back to HTTP polling if PWA is not enabled.
- **Standalone component** – drop it into your app and it just works.
- **Customizable UI** – built‑in notification can be styled or replaced with your own component.
- **Dismiss & remember** – users can dismiss a version; it won’t be shown again until a newer version arrives.
- **Configurable polling interval** – default is 30 seconds.
- **Full TypeScript** – with clear APIs and strong typing.
- **Modern Angular** – supports standalone components and standalone APIs.

---

## Installation

```bash
npm install ngx-update-notifier
```

## Quick Start

### 1. Provide the current version

In your Angular application, provide the current version using the `APP_VERSION` injection token.

**In `app.config.ts` (standalone):**

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { APP_VERSION, Mode } from 'ngx-update-notifier';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    {
      provide: APP_VERSION,
      useValue: {
        appVersion: '1.0.0',           // your current version
        mode: Mode.PL,                 // Polling mode
        checkInterval: 30000,          // optional, defaults to 30000 (30s)
        endpointUrl: '/version.json',  // optional, defaults to '/version.json'
        storageKey: 'my_update_key',   // optional
        applyDefaults: true             // optional, defaults to true
      }
    }
  ]
};
```

**For NgModule based applications**

```typescript
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { APP_VERSION, Mode } from 'ngx-update-notifier';

@NgModule({
  imports: [HttpClientModule],
  providers: [
    {
      provide: APP_VERSION,
      useValue: {
        appVersion: '1.0.0',
        mode: Mode.PL,                 // Polling mode
        checkInterval: 30000,
        endpointUrl: '/version.json',
        storageKey: 'my_update_key',
        applyDefaults: true
      }
    }
  ]
})
export class AppModule {}
```

## Add the component to your app
In your root component template (app.component.html):

```html
import { Component } from '@angular/core';
import { UpdateNotifierComponent } from 'ngx-update-notifier';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [UpdateNotifierComponent],
  template: `
    <router-outlet></router-outlet>
    <ngx-update-notifier />
  `
})
export class AppComponent {}
```

## Generate your `version.json` 

Create a script that writes the current version to src/version.json before each build.

scripts/update-version.js

```javascript
const fs = require('fs');
const pkg = require('../package.json');

fs.writeFileSync('public/version.json', JSON.stringify({ version: pkg.version }));
```

*note in older version of Angular, this will be the assets folder*

Add it to your package.json build command:

```json
"scripts": {
  "build": "node scripts/update-version.js && ng build"
}
```

After building, the file will be available at /version.json in your deployed app. The library polls this file (or your custom endpoint) and compares the version value with the one you provided.

*note the url is not necessarily /version.json, it can be whatever you named it as long as is configured correctly in your providers.*

## 🧠 How It Works

### Polling Mode (Mode.PL)
The component periodically fetches a static `version.json` file from your server and compares its version with the current one. If a newer version is found, the notification appears.

### Service Worker Mode (Mode.SW)
If your app is a PWA with an active Service Worker, the library listens to the Service Worker’s `versionUpdates` event. When a new version is ready, the notification appears – no polling required.

The library automatically falls back to polling mode if Service Worker is not enabled, so you can safely use `Mode.SW` in all environments.

⚙️ Configuration Options
The `APP_VERSION` injection token accepts the following configuration:

| Option           | Type      | Default                     | Description                                                                 |
|------------------|-----------|-----------------------------|-----------------------------------------------------------------------------|
| `appVersion`     | `string`  | **required**                | The current version of your application (e.g., `"1.0.0"`).                  |
| `mode`           | `Mode`    | **required**                | Either `Mode.PL` (Polling) or `Mode.SW` (Service Worker).                   |
| `checkInterval`  | `number`  | `30000` (30 seconds)        | Interval (in milliseconds) for checking updates in polling mode.            |
| `endpointUrl`    | `string`  | `'/version.json'`           | URL of the version file in polling mode.                                    |
| `storageKey`     | `string`  | `'ngx_update_dismissed'`    | Key used to store the dismissed version in `localStorage`.                  |
| `applyDefaults`  | `boolean` | `true`                      | When `true`, missing optional values are replaced with defaults.            |

## 🎨 Customizing the Notification

You can either style the built‑in notification (using CSS) or replace the entire UI component.

### Styling the built‑in notification

The default styles are defined in `update-notifier.scss`. Override them in your global styles:

E.G.:
```css
/* Override the notification background color */
.update-notification {
  background: #1976d2;
}

/* Override the "Update Now" button */
.update-btn {
  background: #ff9800;
}
```

## Replacing the component

If you need complete control over the UI, you can create your own component and subscribe to the `VersionCheckService`:

E.G.:

```typescript

import { Component, OnDestroy, inject } from '@angular/core';
import { VersionCheckService, VersionInfo } from 'ngx-update-notifier';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-custom-update-notifier',
  template: `
    <div *ngIf="showNotification" class="my-notification">
      <span>Update available: {{ versionInfo?.latest }}</span>
      <button (click)="refresh()">Refresh</button>
      <button (click)="dismiss()">Dismiss</button>
    </div>
  `
})
export class CustomUpdateNotifierComponent implements OnDestroy {
  private versionService = inject(VersionCheckService);
  private storageService = inject(StorageService);
  private subscription: Subscription;
  showNotification = false;
  versionInfo: VersionInfo | null = null;

  constructor() {
    this.versionService.initUpdateMonitoring();
    this.subscription = this.versionService.versionInfo$.subscribe(info => {
      this.versionInfo = info;
      const dismissedVersion = this.storageService.getPreviousVersion();
      const isNotSameVersion = dismissedVersion !== info.latest;
      this.showNotification = info.updateAvailable && isNotSameVersion;
    });
  }

  refresh() {
    this.versionService.refreshApp();
  }

  dismiss() {
    if (this.versionInfo?.latest) {
      this.storageService.saveDismissedVersion(this.versionInfo.latest);
      this.showNotification = false;
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
```

Then use your custom component instead of <ngx-update-notifier>.

## 📚 API Reference

### VersionCheckService

Responsible for checking for updates and emitting version information.

## `VersionCheckService`

| Member                  | Type                              | Description                                                   |
|-------------------------|-----------------------------------|---------------------------------------------------------------|
| `initUpdateMonitoring()` | `() => void`                      | Starts monitoring for updates based on the configured mode.   |
| `refreshApp()`          | `() => void`                      | Reloads the application.                                      |
| `versionInfo$`          | `Subject<VersionInfo>`            | Observable that emits the current version information.        |

### Mode

```typescript
enum Mode {
  SW = 'ServiceWorker',   // Uses Service Worker to detect updates
  PL = 'Polling'          // Periodically polls a version.json file
}
```

### `VersionInfo` interface

```typescript
interface VersionInfo {
  current: string;          // The current application version
  latest: string | null;    // The latest detected version (or null if check failed)
  updateAvailable: boolean; // Whether an update is available
}
```

## ❓ Frequently Asked Questions

### Does it work with Angular Universal (SSR)?
Yes. The library checks for window availability before accessing localStorage and other browser APIs, so it works out of the box with SSR.

### How does dismiss & remember work?
When a user dismisses the notification, the dismissed version is saved in localStorage. The notification will not reappear for that specific version, even if the library keeps polling. Once a newer version is detected, the notification will be shown again.

### Can I use it alongside an existing PWA setup?
Absolutely. If you set mode: Mode.SW, the library will listen to the Service Worker’s versionUpdates event without interfering with your existing PWA code.

### What if my server returns a different JSON structure?
The library expects a JSON object with a version property (e.g., { version: "1.0.0" }). If your structure is different, you can use polling mode and implement a custom check by creating your own component and injecting HttpClient.

----

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request on the repository.

----

## 📄 License
Apache 2.0 © (bargross)[https://github.com/bargross]
