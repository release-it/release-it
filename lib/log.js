import { EOL } from 'node:os';
import chalk from 'chalk';
import _ from 'lodash';

const { isObject, last, filter, isString, lowerCase, upperFirst, isArray } = _;

class Logger {
  constructor({ isCI = true, isVerbose = false, verbosityLevel = 0, isDryRun = false } = {}) {
    this.isCI = isCI;
    this.isVerbose = isVerbose;
    this.verbosityLevel = verbosityLevel;
    this.isDryRun = isDryRun;
  }

  shouldLog(isExternal) {
    return this.verbosityLevel === 2 || (this.isVerbose && isExternal);
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
    if (this.shouldLog(isExternal)) {
      this.log(...filter(args, isString));
    }
  }

  exec(...args) {
    const { isDryRun: isExecutedInDryRun, isExternal, isCached } = isObject(last(args)) ? last(args) : {};
    if (this.shouldLog(isExternal) || this.isDryRun) {
      const prefix = isExecutedInDryRun == null ? '$' : '!';
      const command = args.map(cmd => (isString(cmd) ? cmd : isArray(cmd) ? cmd.join(' ') : '')).join(' ');
      const message = [prefix, command, isCached ? '[cached]' : ''].join(' ').trim();
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

export default Logger;
