import util from 'node:util';
import Shell from '../../lib/shell.js';

const debug = util.debug('release-it:shell-stub');

class ShellStub extends Shell {
  exec(command) {
    const cmd = Array.isArray(command) ? command.join(' ') : command;
    if (/^(npm (ping|publish|show)|git fetch)/.test(cmd)) {
      debug(cmd);
      return Promise.resolve();
    }
    if (/^npm whoami/.test(cmd)) {
      debug(cmd);
      return Promise.resolve('john');
    }
    if (/^npm access/.test(cmd)) {
      debug(cmd);
      return Promise.resolve(JSON.stringify({ john: ['write'] }));
    }
    return super.exec(...arguments);
  }
}

export default ShellStub;
