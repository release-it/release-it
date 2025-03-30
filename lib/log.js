import { EOL } from 'node:os';
import { styleText } from 'node:util';
import { isObjectLoose } from '@phun-ky/typeof';
import { upperFirst } from './util.js';

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
    console.log(...args);
  }

  error(...args) {
    console.error([styleText('red', 'ERROR'), ...args].join(' '));
  }

  info(...args) {
    console.error(styleText('grey', args.join(' ')));
  }

  warn(...args) {
    console.error([styleText('yellow', 'WARNING'), ...args].join(' '));
  }

  verbose(...args) {
    const { isExternal } = isObjectLoose(args.at(-1)) ? args.at(-1) : {};
    if (this.shouldLog(isExternal)) {
      console.error(...args.filter(str => typeof str === 'string'));
    }
  }

  exec(...args) {
    const { isDryRun: isExecutedInDryRun, isExternal, isCached } = isObjectLoose(args.at(-1)) ? args.at(-1) : {};
    if (this.shouldLog(isExternal) || this.isDryRun) {
      const prefix = isExecutedInDryRun == null ? '$' : '!';
      const command = args
        .map(cmd => (typeof cmd === 'string' ? cmd : Array.isArray(cmd) ? cmd.join(' ') : ''))
        .join(' ');
      const message = [prefix, command, isCached ? '[cached]' : ''].join(' ').trim();
      console.error(message);
    }
  }

  obtrusive(...args) {
    if (!this.isCI) this.log();
    this.log(...args);
    if (!this.isCI) this.log();
  }

  preview({ title, text }) {
    if (text) {
      const header = styleText('bold', upperFirst(title));
      const body = text.replace(new RegExp(EOL + EOL, 'g'), EOL);
      this.obtrusive(`${header}:${EOL}${body}`);
    } else {
      this.obtrusive(`Empty ${title.toLowerCase()}`);
    }
  }
}

export default Logger;
