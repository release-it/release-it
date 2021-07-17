import _debug from 'debug';
import Shell from '../../lib/shell';

const debug = _debug('release-it:shell-stub');

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
