const ora = require('ora');
const { config } = require('./config');
const { debugConfig } = require('./debug');

const showSpinner = !config.isInteractive && !config.isVerbose && !config.isDryRun && !debugConfig.enabled;

const noop = Promise.resolve();

const spinner = showSpinner
  ? ora()
  : {
      init: () => spinner,
      start: () => spinner,
      succeed: () => spinner,
      warn: () => spinner,
      fail: () => spinner
    };

const getSpinner = () => spinner;

const taskSpinner = (shouldRun, task, txt) => {
  if (!shouldRun) return noop;
  const p = task();
  if (showSpinner) {
    ora.promise(p, txt);
  }
  return p;
};

module.exports = {
  getSpinner,
  spinner: taskSpinner
};
