const { EOL } = require('os');
const chalk = require('chalk');
const _ = require('lodash');

class Logger {
  constructor({ isCI = true, isVerbose = false, isDryRun = false } = {}) {
    this.isCI = isCI;
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
    this.log(chalk.grey(...args));
  }
  warn(...args) {
    this.log(chalk.yellow('WARNING'), ...args);
  }
  verbose(...args) {
    this.isVerbose && this.log(...args);
  }
  exec(...args) {
    if (this.isVerbose || this.isDryRun) {
      const isNotExecuted = typeof _.last(args) === 'boolean' && _.last(args) === true;
      const prefix = isNotExecuted ? '!' : '$';
      this.log(prefix, ..._.filter(args, _.isString));
    }
  }
  obtrusive(...args) {
    if (!this.isCI) this.log();
    this.log(...args);
    if (!this.isCI) this.log();
  }
  preview({ title, text }) {
    if (text) {
      const header = chalk.bold(_.upperFirst(title));
      const body = text.replace(new RegExp(EOL + EOL, 'g'), EOL);
      this.obtrusive(`${header}:${EOL}${body}`);
    } else {
      this.obtrusive(`Empty ${_.lowerCase(title)}`);
    }
  }
}

module.exports = Logger;
