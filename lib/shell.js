const cpy = require('cpy');
const sh = require('shelljs');
const _ = require('lodash');
const bumpFile = require('bump-file');
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
  }

  // TODO: there should be a single `exec` method
  _exec(command, options = {}) {
    const normalizedCmd = command.replace(forcedCmdRe, '').trim();
    const program = normalizedCmd.split(' ')[0];
    const programArgs = normalizedCmd.split(' ').slice(1);
    const isWrite = options.write !== false;

    if (this.global.isDryRun && isWrite) {
      this.log.exec(normalizedCmd, this.global.isDryRun);
      return noop;
    }

    return new Promise((resolve, reject) => {
      const cb = (code, stdout, stderr) => {
        stdout = stdout.toString().trim();
        this.log.exec(normalizedCmd);
        this.log.verbose(stdout);
        debug({ command, options, code, stdout, stderr });
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || stdout));
        }
      };

      if (program in sh && typeof sh[program] === 'function' && forcedCmdRe.test(command)) {
        cb(0, sh[program](...programArgs));
      } else {
        sh.exec(normalizedCmd, { async: true }, cb);
      }
    });
  }

  exec(command, options = {}, context = {}) {
    return command ? this._exec(format(command, context), options) : noop;
  }

  pushd(path) {
    return this.exec(`!pushd ${path}`);
  }

  popd() {
    return this.exec('!popd');
  }

  copy(files, target, options = {}) {
    const opts = Object.assign({ parents: true, nodir: true }, options);
    this.log.exec('copy', files, target, opts, this.isDryRun);
    debug({ command: 'copy', files, target, options });
    if (this.global.isDryRun) {
      return noop;
    }
    return cpy(files, target, opts);
  }

  bump(files, version) {
    this.log.exec('bump', files, version, this.isDryRun);
    debug({ command: 'bump', files, version });
    if (this.global.isDryRun) {
      return noop;
    }
    const sanitizedFiles = _.compact(_.castArray(files));
    const bumper = file => bumpFile(file, version).catch(() => this.log.warn(`Could not bump ${file}`));
    return Promise.all(sanitizedFiles.map(bumper));
  }
}

module.exports = Shell;
