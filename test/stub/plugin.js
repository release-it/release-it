import Plugin from '../../lib/plugin/Plugin.js';

class MyPlugin extends Plugin {
  init() {
    this.log.info(`${this.namespace}:${this.getContext('name')}:init`);
  }
  getName() {
    this.log.info(`${this.namespace}:${this.getContext('name')}:getName`);
    return 'new-project-name';
  }
  getLatestVersion() {
    this.log.info(`${this.namespace}:${this.getContext('name')}:getLatestVersion`);
    return '1.2.3';
  }
  getIncrement() {
    this.log.info(`${this.namespace}:${this.getContext('name')}:getIncrement`);
    return 'minor';
  }
  getIncrementedVersionCI() {
    this.log.info(`${this.namespace}:${this.getContext('name')}:getIncrementedVersionCI`);
  }
  beforeBump() {
    this.log.info(`${this.namespace}:${this.getContext('name')}:beforeBump`);
  }
  bump(version) {
    this.log.info(`${this.namespace}:${this.getContext('name')}:bump:${version}`);
  }
  beforeRelease() {
    this.log.info(`${this.namespace}:${this.getContext('name')}:beforeRelease`);
  }
  release() {
    this.log.info(`${this.namespace}:${this.getContext('name')}:release`);
  }
  afterRelease() {
    this.log.info(`${this.namespace}:${this.getContext('name')}:afterRelease`);
  }
}

export default MyPlugin;
