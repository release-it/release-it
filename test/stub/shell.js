const debug = require('debug');
const Shell = require('../../lib/shell');

module.exports = class ShellStub extends Shell {
  exec(command) {
    if (/^(npm|git fetch)/.test(command)) {
      debug('release-it:shell-stub')(command);
      return Promise.resolve();
    }
    return super.exec(...arguments);
  }
};
