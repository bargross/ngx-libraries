import { InjectionToken } from "@angular/core";

export const LOCAL_STORAGE = new InjectionToken<Storage | null>(
  'LOCAL_STORAGE',
  {
    providedIn: 'root',
    factory: () => (typeof window !== 'undefined' ? localStorage : null)
  }
);
