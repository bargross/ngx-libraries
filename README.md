#### Package has not been released yet, is still being developed.

# ngx-libraries

A collection of Angular libraries published as npm packages.  
This monorepo uses Angular CLI and is structured to host multiple independent libraries.

## 📦 Packages

| Package | Version | Description | Documentation |
|---------|---------|-------------|----------------|
| `ngx-update-notifier` | ![npm version](https://img.shields.io/npm/v/ngx-update-notifier) | Automatically detects new app versions and prompts users to refresh – no Service Worker required. | [README](https://github.com/bargross/ngx-libraries/blob/main/ngx-libraries-workspace/projects/ngx-update-notifier/README.md) |
| `ngx-query-state` | ![npm version](https://img.shields.io/npm/v/ngx-query-state) | is a lightweight, RxJS-first library that eliminates pagination boilerplate. It manages loading states, errors, sorting, filtering, and caching – so you can focus on building your UI. | Not Available yet... |

> **More packages coming soon** – this repository will host additional Angular utilities, UI components, and tools.

## 🚀 Getting Started with `ngx-update-notifier`

The first package from this collection is `ngx-update-notifier`.  
See its full documentation, installation guide, and API reference here:  
👉 [**ngx-update-notifier/README.md**](https://github.com/bargross/ngx-libraries/blob/main/ngx-libraries-workspace/projects/ngx-update-notifier/README.md)

Quick install:

```bash
npm install ngx-update-notifier
```

## Current Stage
Initial release: ngx-update-notifier is stable and ready for use in production Angular apps (v16+).

The library is fully tested with Vitest and includes a standalone component, configurable polling, and localStorage dismissal.

This monorepo is actively maintained; the first package is published and documented.

## Roadmap
- Q2 2026 - Add pagination http interface for pagination APIs. 
- Q3 2026 – Add configuration tokens to ngx-update-notifier (custom endpoint, polling interval, storage key).

## License

Apache 2.0
