import { Inject, Injectable } from "@angular/core";
import { AppVersionConfig } from "../models";
import { isNullEmptyOrWhitespace } from "../utils";
import { AppVersionConfigDefaults } from "../constants/app-version-constants";
import { LOCAL_STORAGE, APP_VERSION } from "../tokens";


@Injectable({providedIn: 'root'})
export class StorageService {
  private storageKey: string | null = null;

  constructor(
    @Inject(APP_VERSION) private versionConfig: AppVersionConfig,
    @Inject(LOCAL_STORAGE) private storage: Storage
  ) {
    this.storageKey = this.getStorageKey();
  }

  public saveDismissedVersion(version: string): void {
    this.storage.setItem(this.storageKey as string, version);
  }

  public getPreviousVersion(): string | null {
    return this.storage.getItem(this.storageKey as string);
  }


  private getStorageKey(): string {
    let applyDefaults = this.versionConfig?.applyDefaults === null || this.versionConfig?.applyDefaults === undefined ? false : this.versionConfig?.applyDefaults;

    if (isNullEmptyOrWhitespace(this.versionConfig?.storageKey) && applyDefaults) {
      return AppVersionConfigDefaults.storageKey;
    }

    if (isNullEmptyOrWhitespace(this.versionConfig.storageKey) && !applyDefaults) {
      throw Error("Missing storage key.");
    }

    return this.versionConfig?.storageKey as string;
  }
}
