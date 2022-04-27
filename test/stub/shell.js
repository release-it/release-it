import util from 'node:util';
import Shell from '../../lib/shell.js';

const debug = util.debug('release-it:shell-stub');

class ShellStub extends Shell {
  exec(command) {
    if (/^(npm (ping|publish|show)|git fetch)/.test(command)) {
      debug(command);
      return Promise.resolve();
    }
    if (/^npm whoami/.test(command)) {
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

export default ShellStub;
