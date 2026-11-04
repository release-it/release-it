import { Plugin } from '../';

export type PluginOptions = false | { dummy: string };

export class PluginStaticMethods extends Plugin {
  static override isEnabled(options: PluginOptions): Promise<boolean> {
    return Promise.resolve(options !== false);
  }

  static override disablePlugin(options: PluginOptions): string[] {
    return ['plugin1', 'plugin2'];
  }
}
