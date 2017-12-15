const { version, help } = require('./cli');
const { config } = require('./config');
const runTasks = require('./tasks');
const { trackEvent, trackException } = require('./metrics');

module.exports = async options => {
  if (config.isShowVersion) {
    version();
  } else if (config.isShowHelp) {
    help();
  } else {
    trackEvent('start');
    return runTasks(options).then(
      result => trackEvent('end').then(() => result),
      err => trackException(err).then(() => Promise.reject(err))
    );
  }
  return Promise.resolve();
};
