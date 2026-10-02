import { Plugin } from '../';
import fs from 'fs';
import path from 'path';
import { PluginConstructorArgs } from '../types/plugin';

const prompts = {
  publish: {
    type: 'confirm',
    message: (context: any) => `Publish version ${context.version} of ${context.name}?`
  }
};

interface MyVersionPluginContext {
  versionFile: string;
  latestVersion: string;
  version: string;
  isReleased: boolean;
}

class MyVersionPlugin extends Plugin<any, MyVersionPluginContext> {
  constructor(constructorArgs: PluginConstructorArgs) {
    super(constructorArgs);
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
  override init() {
    const data = fs.readFileSync(this.context.versionFile);
    const latestVersion = data.toString().trim();
    this.setContext({ latestVersion });
  }
  getPackageName() {
    return this.config.getContext('name');
  }
  override getLatestVersion() {
    return this.getContext('latestVersion');
  }
  override bump(version: string) {
    this.setContext({ version });
    fs.writeFileSync(this.getContext('versionFile'), version);
  }
  override async release() {
    await this.step({ task: () => this.publish(), label: 'Publish with pkg-manager', prompt: 'publish' });
  }
  publish() {
    // <insert command to publish>, example: await this.exec('pkg-manager publish');
    (this as any).isReleased = true;
  }
  override afterRelease() {
    if ((this as any).isReleased) {
      const name = this.getPackageName();
      const { version } = this.getContext();
      this.log.log(`🔗 https://registry.example.org/${name}/${version}`);
    }
  }
}

export default MyVersionPlugin;