# Example plugin: release-it-version

This example reads a `VERSION` file, bumps it, and publishes to a package repository. It is only enabled if the
`./VERSION` actually exists.

```javascript
const Plugin = require('release-it/Plugin');
const fs = require('fs');
const path = require('path');

const prompts = {
  publish: {
    type: 'confirm',
    message: context => `Publish version ${context.version} of ${context['release-it-version'].name}?`
  }
};

class MyVersionPlugin extends Plugin {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
    this.versionFile = path.resolve('./VERSION');
  }
  static isEnabled() {
    try {
      fs.accessSync('./VERSION');
      return true;
    } catch (err) {}
    return false;
  }
  init() {
    this.latestVersion = fs.readFileSync(this.versionFile).trim();
  }
  getName() {
    return this.options.name;
  }
  getLatestVersion() {
    return this.latestVersion;
  }
  bump(version) {
    this.version = version;
    fs.writeFileSync(this.versionFile, version);
  }
  async release() {
    await this.step({ task: () => this.publish(), label: 'Publish with pkg-manager', prompt: 'publish' });
  }
  publish() {
    // <insert command to publish>, example: await this.exec('pkg-manager publish');
    this.isReleased = true;
  }
  afterRelease() {
    if (this.isReleased) {
      this.log.log(`🔗 https://example.package-manager.org/${this.getName()}/${this.version}`);
    }
  }
}

module.exports = MyVersionPlugin;
```

To add this plugin to a project, use this configuration:

```json
{
  "plugins": {
    "release-it-version": {
      "name": "my-pkg"
    }
  }
}
```
