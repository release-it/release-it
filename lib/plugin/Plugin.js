const debug = require('debug');
const _ = require('lodash');

class Plugin {
  static isEnabled() {
    return true;
  }

  static disablePlugin() {
    return null;
  }

  constructor({ namespace, options = {}, global = {}, container = {} } = {}) {
    this.namespace = namespace;
    this.options = Object.freeze(this.getInitialOptions(options, namespace));
    this.global = global;
    this.context = {};
    this.config = container.config;
    this.log = container.log;
    this.shell = container.shell;
    this.spinner = container.spinner;
    this.prompt = container.prompt;
    this.debug = debug(`release-it:${namespace}`);
  }

  getInitialOptions(options, namespace) {
    return options[namespace] || {};
  }

  init() {}
  getName() {}
  getLatestVersion() {}
  getChangelog() {}
  getIncrementedVersionCI() {}
  getIncrementedVersion() {}
  beforeBump() {}
  bump() {}
  beforeRelease() {}
  release() {}
  afterRelease() {}

  getContext(path) {
    const context = Object.assign({}, this.options, this.context);
    return path ? _.get(context, path) : context;
  }

  setContext(context) {
    _.merge(this.context, context);
  }

  exec(command, { options, context = {} } = {}) {
    const ctx = Object.assign(context, this.config.getContext(), { [this.namespace]: this.getContext() });
    return this.shell.exec(command, options, ctx);
  }

  registerPrompts(prompts) {
    this.prompt.register(prompts, this.namespace);
  }

  async showPrompt(options) {
    options.namespace = this.namespace;
    return this.prompt.show(options);
  }

  step(options) {
    const context = Object.assign({}, this.config.getContext(), { [this.namespace]: this.getContext() });
    const opts = Object.assign({}, options, { context });
    return this.global.isCI ? this.spinner.show(opts) : this.showPrompt(opts);
  }
}

module.exports = Plugin;
