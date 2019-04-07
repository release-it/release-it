const { version, help } = require('./cli');
const runTasks = require('./tasks');
const Plugin = require('./plugin/Plugin');

module.exports = async options => {
  if (options.version) {
    version();
  } else if (options.help) {
    help();
  } else {
    return runTasks(options);
  }
  return Promise.resolve();
};

module.exports.Plugin = Plugin;
