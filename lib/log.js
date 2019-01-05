const chalk = require('chalk');

class Logger {
  constructor({ isInteractive = false, isVerbose = false, isDryRun = false } = {}) {
    this.isInteractive = isInteractive;
    this.isVerbose = isVerbose;
    this.isDryRun = isDryRun;
  }
  log(...args) {
    console.log(...args); // eslint-disable-line no-console
  }
  error(...args) {
    console.error(chalk.red('ERROR'), ...args); // eslint-disable-line no-console
  }
  info(...args) {
    this.isInteractive && this.log(chalk.grey(...args));
  }
  warn(...args) {
    this.log(chalk.yellow('WARNING'), ...args);
  }
  verbose(...args) {
    this.isVerbose && this.log(...args);
  }
  exec(...args) {
    (this.isVerbose || this.isDryRun) && this.log('$', ...args);
  }
  dry() {
    this.log(chalk.grey('(not executed in dry run)'));
  }
}

module.exports = Logger;
