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

    try {
      const result = await runTasks(options);

      trackEvent('end');
      return result;
    } catch (error) {
      trackException(error);
    }
  }
  return Promise.resolve();
};
