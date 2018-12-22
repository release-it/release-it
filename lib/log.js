const chalk = require('chalk');

const MOVE_LEFT = Buffer.from('1b5b3130303044', 'hex').toString();
const CLEAR_LINE = Buffer.from('1b5b304b', 'hex').toString();

const IS_VERBOSE = (process.env.DEBUG || '').includes('release-it');

class Logger {
  constructor({ isInteractive = false, isVerbose = IS_VERBOSE, isDryRun = false } = {}) {
    this.isInteractive = isInteractive;
    this.isVerbose = isVerbose;
    this.isDryRun = isDryRun;
    this.clearLine = this.isInteractive ? '' : MOVE_LEFT + CLEAR_LINE;
  }
  log(...args) {
    console.log(...args);
  }
  info(...args) {
    this.isInteractive && this.log(this.clearLine + chalk.grey(...args));
  }
  warn(...args) {
    this.log(this.clearLine + chalk.yellow('WARNING'), ...args);
  }
  verbose(...args) {
    this.isVerbose && this.log(...args);
  }
  error(...args) {
    console.error(this.clearLine + chalk.red('ERROR'), ...args);
  }
  exec(...args) {
    (this.isVerbose || this.isDryRun) && this.log('$', ...args);
  }
  dry() {
    this.log(chalk.grey('(not executed in dry run)'));
  }
}

module.exports = Logger;
