import { Plugin } from 'release-it';

class PluginWithDisabledSteps extends Plugin {
  override getName() {
    return undefined;
  }
  override getLatestVersion() {
    return undefined;
  }
  override getChangelog() {
    return undefined;
  }
  override getIncrement() {
    return undefined;
  }
  override getIncrementedVersionCI() {
    return undefined;
  }
  override getIncrementedVersion() {
    return undefined;
  }

  override init() {
    return false;
  }
  override beforeBump() {
    return false;
  }
  override bump(version: string) {
    return false;
  }
  override beforeRelease() {
    return false;
  }
  override release() {
    return false;
  }
  override afterRelease() {
    return false;
  }
}

class PluginWithAsyncDisabledSteps extends Plugin {
  override async getName() {
    return undefined;
  }
  override async getLatestVersion() {
    return undefined;
  }
  override async getChangelog() {
    return undefined;
  }
  override async getIncrement() {
    return undefined;
  }
  override async getIncrementedVersionCI() {
    return undefined;
  }
  override async getIncrementedVersion() {
    return undefined;
  }

  override async init() {
    return false;
  }
  override async beforeBump() {
    return false;
  }
  override async bump(version: string) {
    return false;
  }
  override async beforeRelease() {
    return false;
  }
  override async release() {
    return false;
  }
  override async afterRelease() {
    return false;
  }
}
