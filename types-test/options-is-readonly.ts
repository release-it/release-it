import { Plugin } from 'release-it';

interface PluginOptions {
  someString: string;
}

export class OptionsIsReadonlyPlugin extends Plugin<PluginOptions> {
  override init(): void {
    super.init();
    this.options.someString = 'new value';
  }
}
