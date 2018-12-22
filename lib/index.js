const { version, help } = require('./cli');
const runTasks = require('./tasks');

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
