const { EOL } = require('os');
const chalk = require('chalk');
const { isObject, last, filter, isString, lowerCase, upperFirst } = require('lodash');

class Logger {
  constructor({ isCI = true, isVerbose = false, verbosityLevel = 0, isDryRun = false } = {}) {
    this.isCI = isCI;
    this.isVerbose = isVerbose;
    this.verbosityLevel = verbosityLevel;
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
    const { isExternal } = isObject(last(args)) ? last(args) : {};
    if (this.verbosityLevel === 2 || (this.isVerbose && (isExternal || this.isDryRun))) {
      this.log(...filter(args, isString));
    }
  }
  exec(...args) {
    const { isDryRun: isExecutedInDryRun, isExternal, isCached } = isObject(last(args)) ? last(args) : {};
    if (this.verbosityLevel === 2 || this.isDryRun || (this.isVerbose && isExternal)) {
      const prefix = isExecutedInDryRun == null ? '$' : '!';
      const message = [prefix, ...filter(args, isString), isCached ? '[cached]' : ''].join(' ').trim();
      this.log(message);
    }
  }
  obtrusive(...args) {
    if (!this.isCI) this.log();
    this.log(...args);
    if (!this.isCI) this.log();
  }
  preview({ title, text }) {
    if (text) {
      const header = chalk.bold(upperFirst(title));
      const body = text.replace(new RegExp(EOL + EOL, 'g'), EOL);
      this.obtrusive(`${header}:${EOL}${body}`);
    } else {
      this.obtrusive(`Empty ${lowerCase(title)}`);
    }
  }
}

module.exports = Logger;
