const ora = require('ora');
const { format } = require('./util');

const noop = Promise.resolve();

class Spinner {
  constructor({ container = {} } = {}) {
    this.config = container.config;
    this.ora = container.ora || ora;
  }
  show({ enabled = true, task, label, external = false, context }) {
    if (!enabled) return noop;

    const { config } = this;
    this.isSpinnerDisabled = !config.isCI || config.isVerbose || config.isDryRun || config.isDebug;
    this.canForce = !config.isCI && !config.isVerbose && !config.isDryRun && !config.isDebug;

    const awaitTask = task();

    if (!this.isSpinnerDisabled || (external && this.canForce)) {
      const text = format(label, context);
      this.ora.promise(awaitTask, text);
    }

    return awaitTask;
  }
}

module.exports = Spinner;
