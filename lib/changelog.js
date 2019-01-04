const Shell = require('./shell');
const { CreateChangelogError } = require('./errors');
const { debugGit } = require('./debug');

const noop = Promise.resolve();

class Changelog {
  constructor(options = {}) {
    this.shell = options.shell || new Shell();
  }
  create(command, latestTag) {
    let run = noop;
    if (command) {
      if (/^git log/.test(command)) {
        const cmd = command.replace(/\[REV_RANGE\]/, latestTag ? `${latestTag}...HEAD` : '');
        run = this.shell.run(cmd);
      } else {
        run = this.shell.runTemplateCommand(command);
      }
    }
    return run.catch(err => {
      debugGit(err);
      throw new CreateChangelogError(command);
    });
  }
}

module.exports = Changelog;
