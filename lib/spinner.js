const ora = require('ora');
const { debugConfig } = require('./debug');

const noop = Promise.resolve();

class Spinner {
  constructor(options) {
    this.showSpinner = !options.isInteractive && !options.isVerbose && !options.isDryRun && !debugConfig.enabled;
  }
  show(shouldRun, task, txt) {
    if (!shouldRun) return noop;
    const p = task();
    if (this.showSpinner) {
      ora.promise(p, txt);
    }
    return p;
  }
}

module.exports = Spinner;
