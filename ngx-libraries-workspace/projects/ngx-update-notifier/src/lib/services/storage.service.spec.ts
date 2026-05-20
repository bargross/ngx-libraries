import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';
import { APP_VERSION } from '../tokens/update-notifier.token';
import { AppVersionConfig } from '../models';
import { AppVersionConfigDefaults } from '../constants/app-version-constants';
import { LOCAL_STORAGE } from '../tokens/local-storage.token';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface StorageMock {
  store: Record<string, string>,
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  clear(): void;
  removeItem(key: string): void;
}

const storageMock: StorageMock = {
  store: {} as Record<string, string>,
  getItem(key: string) { return this.store[key] ?? null;  },
  setItem(key: string, value: string) { this.store[key] = value; },
  clear() { this.store = {}; },
  removeItem(key: string) { delete this.store[key]; },
};

function createService(config: Partial<AppVersionConfig>): StorageService {
  TestBed.resetTestingModule();

  TestBed.configureTestingModule({
    providers: [
      StorageService,
      { provide: APP_VERSION, useValue: config },
      { provide: LOCAL_STORAGE, useValue: storageMock }
    ],
  });

  return TestBed.inject(StorageService);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('StorageService', () => {

  beforeEach(() => {
    storageMock.clear();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Construction / storageKey initialisation
  // -------------------------------------------------------------------------

  describe('initialisation', () => {
    afterEach(() => vi.resetAllMocks());

    it('should create the service when a valid storageKey is provided', () => {
      const service = createService({ storageKey: 'my-key' });
      expect(service).toBeTruthy();
    });

    it('should set storageKey from config when provided', () => {
      const service = createService({ storageKey: 'my-key' });

      const spyObj = vi.spyOn(storageMock, 'getItem');

      service.getPreviousVersion();

      expect(spyObj).toHaveBeenCalledWith('my-key');
    });

    ['', ' ', undefined].forEach( (key: string | undefined) => {
      it('should fall back to the default storageKey when applyDefaults is true and storageKey is invalid', () => {
        const service = createService({ storageKey: key, applyDefaults: true });
        const spyObj = vi.spyOn(storageMock, 'getItem');

        service.getPreviousVersion();

        expect(spyObj).toHaveBeenCalledWith(AppVersionConfigDefaults.storageKey);
      });
    });

    ['', ' ', null, undefined].forEach(key => {
      it('should throw when storageKey is invalid and applyDefaults is false', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => createService({ storageKey: key as any, applyDefaults: false }))
          .toThrow('Missing storage key.');
      });
    });

    it('should treat applyDefaults as false when it is null', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => createService({ storageKey: null as any, applyDefaults: null as any }))
        .toThrow('Missing storage key.');
    });

    it('should treat applyDefaults as false when it is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => createService({ storageKey: undefined as any, applyDefaults: undefined as any }))
        .toThrow('Missing storage key.');
    });

    it('should prefer the explicit storageKey over the default even when applyDefaults is true', () => {
      const service = createService({ storageKey: 'explicit-key', applyDefaults: true });
      const spyObj = vi.spyOn(storageMock, 'getItem');

      service.getPreviousVersion();

      expect(spyObj).toHaveBeenCalledWith('explicit-key');
    });
  });

  // -------------------------------------------------------------------------
  // saveDismissedVersion
  // -------------------------------------------------------------------------

  describe('saveDismissedVersion', () => {
    it('should write the version string to localStorage under the configured key', () => {
      const service = createService({ storageKey: 'app-version' });

      service.saveDismissedVersion('1.2.3');

      expect(storageMock.getItem('app-version')).toBe('1.2.3');
    });

    it('should overwrite an existing value', () => {
      const service = createService({ storageKey: 'app-version' });

      service.saveDismissedVersion('1.0.0');
      service.saveDismissedVersion('2.0.0');

      expect(storageMock.getItem('app-version')).toBe('2.0.0');
    });

    it('should save an empty string without throwing', () => {
      const service = createService({ storageKey: 'app-version' });

      expect(() => service.saveDismissedVersion('')).not.toThrow();

      expect(storageMock.getItem('app-version')).toBe('');
    });

    it('should call localStorage.setItem with the correct key and value', () => {
      const spy = vi.spyOn(storageMock, 'setItem');

      const service = createService({ storageKey: 'app-version' });

      service.saveDismissedVersion('3.0.0');

      expect(spy).toHaveBeenCalledWith('app-version', '3.0.0');
    });
  });

  // -------------------------------------------------------------------------
  // getPreviousVersion
  // -------------------------------------------------------------------------

  describe('getPreviousVersion', () => {
    it('should return null when nothing has been saved', () => {
      const service = createService({ storageKey: 'app-version' });

      expect(service.getPreviousVersion()).toBeNull();
    });

    it('should return the previously saved version', () => {
      const service = createService({ storageKey: 'app-version' });

      service.saveDismissedVersion('1.2.3');

      expect(service.getPreviousVersion()).toBe('1.2.3');
    });

    it('should return the most recently saved version after multiple saves', () => {
      const service = createService({ storageKey: 'app-version' });

      service.saveDismissedVersion('1.0.0');
      service.saveDismissedVersion('2.0.0');

      expect(service.getPreviousVersion()).toBe('2.0.0');
    });

    it('should call localStorage.getItem with the correct key', () => {
      const spy = vi.spyOn(storageMock, 'getItem');

      const service = createService({ storageKey: 'app-version' });

      service.getPreviousVersion();

      expect(spy).toHaveBeenCalledWith('app-version');
    });

    it('should return null after localStorage is cleared', () => {
      const service = createService({ storageKey: 'app-version' });

      service.saveDismissedVersion('1.0.0');

      storageMock.clear();

      expect(service.getPreviousVersion()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // localStorage failure handling
  // -------------------------------------------------------------------------

  describe('localStorage error handling', () => {
    it('should propagate errors thrown by localStorage.setItem (e.g. storage quota exceeded)', () => {
      vi.spyOn(storageMock, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const service = createService({ storageKey: 'app-version' });
      expect(() => service.saveDismissedVersion('1.0.0')).toThrow();
    });

    it('should propagate errors thrown by localStorage.getItem', () => {
      vi.spyOn(storageMock, 'getItem').mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      const service = createService({ storageKey: 'app-version' });
      expect(() => service.getPreviousVersion()).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Key isolation
  // -------------------------------------------------------------------------

  describe('key isolation', () => {
    it('should not read values written under a different key', () => {
      const serviceA = createService({ storageKey: 'key-a' });
      const serviceB = createService({ storageKey: 'key-b' });

      serviceA.saveDismissedVersion('1.0.0');

      expect(serviceB.getPreviousVersion()).toBeNull();
    });

    it('should not overwrite values stored under a different key', () => {
      const serviceA = createService({ storageKey: 'key-a' });
      const serviceB = createService({ storageKey: 'key-b' });

      serviceA.saveDismissedVersion('1.0.0');
      serviceB.saveDismissedVersion('2.0.0');

      expect(serviceA.getPreviousVersion()).toBe('1.0.0');
    });
  });
});
