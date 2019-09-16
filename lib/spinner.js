const ora = require('ora');
const { format } = require('./util');

const noop = Promise.resolve();

class Spinner {
  constructor({ global = {}, container = {} } = {}) {
    this.isSpinnerDisabled = !global.isCI || global.isVerbose || global.isDryRun || global.isDebug;
    this.canForce = !global.isCI && !global.isVerbose && !global.isDryRun && !global.isDebug;
    this.ora = container.ora || ora;
  }
  show({ enabled = true, task, label, external = false, context }) {
    if (!enabled) return noop;
    const awaitTask = task();
    if (!this.isSpinnerDisabled || (external && this.canForce)) {
      const text = format(label, context);
      this.ora.promise(awaitTask, text);
    }
    return awaitTask;
  }
}

module.exports = Spinner;
