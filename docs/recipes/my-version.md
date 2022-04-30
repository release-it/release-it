# Example plugin: my-version

This example reads a `VERSION` file, bumps it, and publishes to a package repository. It is only enabled if the
`./VERSION` file actually exists.

```javascript
import { Plugin } from 'release-it';
import fs from 'fs';
import path from 'path';

const prompts = {
  publish: {
    type: 'confirm',
    message: context => `Publish version ${context.version} of ${context.name}?`
  }
};

class MyVersionPlugin extends Plugin {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
    this.setContext({ versionFile: path.resolve('./VERSION') });
  }
  static isEnabled() {
    try {
      fs.accessSync('./VERSION');
      return true;
    } catch (err) {}
    return false;
  }
  init() {
    const data = fs.readFileSync(this.versionFile);
    const latestVersion = data.toString().trim();
    this.setContext({ latestVersion });
  }
  getPackageName() {
    return this.config.getContext('name');
  }
  getLatestVersion() {
    return this.getContext('latestVersion');
  }
  bump(version) {
    this.setContext({ version });
    fs.writeFileSync(this.getContext('versionFile'), version);
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
      const name = this.getPackageName();
      const { version } = this.getContext();
      this.log.log(`🔗 https://registry.example.org/${name}/${version}`);
    }
  }
}

export default MyVersionPlugin;
```

To add this plugin to a project, use this configuration:

```json
{
  "plugins": {
    "my-version": {
      "unused": "option"
    }
  }
}
```
