const ora = require('ora');

const noop = Promise.resolve();

class Spinner {
  constructor(options) {
    this.isInteractive = options.isInteractive;
    this.isSpinnerDisabled = options.isInteractive || options.isVerbose || options.isDryRun || options.isDebug;
  }
  show({ enabled = true, task, label, forced = false }) {
    if (!enabled) return noop;
    const p = task();
    if (!this.isSpinnerDisabled || (forced && this.isInteractive)) {
      ora.promise(p, label);
    }
    return p;
  }
}

module.exports = Spinner;
