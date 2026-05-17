#### Package has not been released yet, is still being developed.

# ngx-update-notifier

A lightweight, zero‑dependency Angular library that automatically detects new versions of your application and prompts users to refresh the UI. No Service Worker required – works with a simple HTTP polling strategy.

## Features

- ✅ **Automatic version detection** – polls a static `version.json` file on your server
- ✅ **No Service Worker needed** – works with any Angular app (including those without PWA setup)
- ✅ **Standalone component** – drop it into your app and it just works
- ✅ **Customizable UI** – the built‑in notification can be styled or replaced with your own component
- ✅ **Dismiss & remember** – users can dismiss a version; it won’t be shown again until a newer version arrives
- ✅ **Configurable polling interval** – default is 30 seconds
- ✅ **Full TypeScript** – with clear APIs and strong typing

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
import { APP_VERSION } from 'ngx-update-notifier';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    { provide: APP_VERSION, useValue: '1.0.0' } // your current version
  ]
};
```

**In your `app.module.ts`**

```typescript
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { APP_VERSION } from 'ngx-update-notifier';

@NgModule({
  imports: [HttpClientModule],
  providers: [
    { provide: APP_VERSION, useValue: '1.0.0' }
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
fs.writeFileSync('./src/version.json', JSON.stringify({ version: pkg.version }));
```

Add it to your package.json build command:

```json
"scripts": {
  "build": "node scripts/update-version.js && ng build"
}
```

After building, the file will be available at /version.json in your deployed app. The library polls this file and compares the version value with the one you provided.

