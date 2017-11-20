const { version, help } = require('./cli');
const { config } = require('./config');
const runTasks = require('./tasks');
const { trackEvent, trackException } = require('./metrics');

module.exports = options => {
  if (config.isShowVersion) {
    version();
  } else if (config.isShowHelp) {
    help();
  } else {
    trackEvent('start');
    return runTasks(options).then(() => trackEvent('end'), trackException);
  }
  return Promise.resolve();
};
