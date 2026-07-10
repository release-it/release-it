import Plugin from '../../lib/plugin/Plugin.js';

class NoVersionPlugin extends Plugin {
  static disablePlugin() {
    return 'version';
  }
}

export default NoVersionPlugin;
