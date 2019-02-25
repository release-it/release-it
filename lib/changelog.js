const _ = require('lodash');
const Shell = require('./shell');

const noop = Promise.resolve();

class Changelog {
  constructor(injected = {}) {
    this.shell = injected.shell || new Shell();
    this.generate = _.memoize(this.generate);
  }
  generate(command, latestTag) {
    if (command) {
      if (command.startsWith('git log')) {
        const cmd = command.replace(/\[REV_RANGE\]/, latestTag ? `${latestTag}...HEAD` : '');
        return this.shell.run(cmd).catch(err => {
          if (!/not a git repository/.test(err)) {
            throw err;
          }
        });
      } else {
        const option = { isWrite: false };
        return this.shell.runTemplateCommand(command, option);
      }
    }
    return noop;
  }
}

module.exports = Changelog;
