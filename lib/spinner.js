const ora = require('ora');

const noop = Promise.resolve();

class Spinner {
  constructor(options = {}) {
    this.isInteractive = options.isInteractive;
    this.isSpinnerDisabled = options.isInteractive || options.isVerbose || options.isDryRun || options.isDebug;
    this.ora = options.ora || ora;
  }
  show({ enabled = true, task, label, forced = false }) {
    if (!enabled) return noop;
    const awaitTask = task();
    if (!this.isSpinnerDisabled || (forced && this.isInteractive)) {
      this.ora.promise(awaitTask, label);
    }
    return awaitTask;
  }
}

module.exports = Spinner;
