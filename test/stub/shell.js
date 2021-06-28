const debug = require('debug')('release-it:shell-stub');
const Shell = require('../../lib/shell');

class ShellStub extends Shell {
  exec(command) {
    if (/^((npm|pnpm|yarn( npm)?) (ping|publish|show)|git fetch)/.test(command)) {
      debug(command);
      return Promise.resolve();
    }
    if (/^(yarn )?npm whoami/.test(command)) {
      debug(command);
      return Promise.resolve('john');
    }
    if (/^npm access/.test(command)) {
      debug(command);
      return Promise.resolve(JSON.stringify({ john: ['write'] }));
    }
    return super.exec(...arguments);
  }
}

module.exports = ShellStub;
