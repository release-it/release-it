const sh = require('shelljs');
const debug = require('debug')('release-it:shell');
const { format } = require('./util');

sh.config.silent = !debug.enabled;

const noop = Promise.resolve();
const forcedCmdRe = /^!/;

class Shell {
  constructor({ global = {}, container }) {
    this.global = global;
    this.log = container.log;
    this.config = container.config;
    this.Cache = new Set();
  }

  // TODO: there should be a single `exec` method
  _exec(command, options = {}) {
    const normalizedCmd = command.replace(forcedCmdRe, '').trim();
    const program = normalizedCmd.split(' ')[0];
    const programArgs = normalizedCmd.split(' ').slice(1);
    const isWrite = options.write !== false;
    const cacheable = options.cache === true;

    if (this.global.isDryRun && isWrite) {
      this.log.exec(normalizedCmd, this.global.isDryRun);
      return noop;
    }

    if (cacheable && command in this.Cache) {
      return this.Cache[command];
    }

    const awaitExec = new Promise((resolve, reject) => {
      const cb = (code, stdout, stderr) => {
        stdout = stdout.toString().trim();
        this.log.exec(normalizedCmd);
        this.log.verbose(stdout);
        debug({ command, options, code, stdout, stderr });
        if (code === 0) {
          resolve(stdout);
        } else {
          if (stdout && stderr) {
            this.log.log(`\n${stdout}`);
          }
          reject(new Error(stderr || stdout));
        }
      };

      if (program in sh && typeof sh[program] === 'function' && forcedCmdRe.test(command)) {
        cb(0, sh[program](...programArgs));
      } else {
        sh.exec(normalizedCmd, { async: true }, cb);
      }
    });

    if (cacheable && !(command in this.Cache)) {
      this.Cache[command] = awaitExec;
    }

    return awaitExec;
  }

  exec(command, options = {}, context = {}) {
    return command ? this._exec(format(command, context), options) : noop;
  }
}

module.exports = Shell;
