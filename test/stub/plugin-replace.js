import Plugin from '../../lib/plugin/Plugin.js';

class ReplacePlugin extends Plugin {
  static disablePlugin() {
    return ['version', 'git', 'npm'];
  }
}

export default ReplacePlugin;
