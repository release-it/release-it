const debug = require('debug')('release-it:shell-stub');
const Shell = require('../../lib/shell');

module.exports = class ShellStub extends Shell {
  exec(command) {
    if (/^(npm|git fetch)/.test(command)) {
      debug(command);
      return Promise.resolve();
    }
    return super.exec(...arguments);
  }
};
