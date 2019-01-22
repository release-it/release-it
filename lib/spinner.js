const ora = require('ora');
const Config = require('./config');
const { format } = require('./util');

const noop = Promise.resolve();

class Spinner {
  constructor(options = {}) {
    this.isSpinnerDisabled = options.isInteractive || options.isVerbose || options.isDryRun || options.isDebug;
    this.canForce = options.isInteractive && !options.isVerbose && !options.isDryRun && !options.isDebug;
    this.ora = options.ora || ora;
    this.config = options.config || new Config();
  }
  show({ enabled = true, task, label, forced = false }) {
    if (!enabled) return noop;
    const awaitTask = task();
    if (!this.isSpinnerDisabled || (forced && this.canForce)) {
      const text = format(label, this.config.getOptions());
      this.ora.promise(awaitTask, text);
    }
    return awaitTask;
  }
}

module.exports = Spinner;
