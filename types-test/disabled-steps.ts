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
