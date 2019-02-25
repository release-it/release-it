const cpy = require('cpy');
const sh = require('shelljs');
const _ = require('lodash');
const bumpFile = require('bump-file');
const Log = require('./log');
const Config = require('./config');
const debug = require('debug')('release-it:shell');
const { format } = require('./util');

sh.config.silent = !debug.enabled;

const noop = Promise.resolve();
const forcedCmdRe = /^!/;

class Shell {
  constructor(...args) {
    const options = Object.assign({}, ...args);
    this.isVerbose = options.isVerbose;
    this.isDryRun = options.isDryRun;
    this.log = options.log || new Log(options);
    this.config = options.config || new Config(options);
  }

  run(command, options = {}) {
    const normalizedCmd = command.replace(forcedCmdRe, '').trim();
    const program = normalizedCmd.split(' ')[0];
    const programArgs = normalizedCmd.split(' ').slice(1);
    const isWrite = options.isWrite === Shell.writes.isWrite;

    if (this.isDryRun && isWrite) {
      this.log.exec(normalizedCmd, this.isDryRun);
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

  runTemplateCommand(command, options) {
    const context = this.config.getOptions();
    return command ? this.run(format(command, context), Object.assign({}, Shell.writes, options)) : noop;
  }

  pushd(path) {
    return this.run(`!pushd ${path}`);
  }

  popd() {
    return this.run('!popd');
  }

  copy(files, target, options = {}) {
    const opts = Object.assign({ parents: true, nodir: true }, options);
    this.log.exec('copy', files, target, opts, this.isDryRun);
    debug({ command: 'copy', files, target, options });
    if (this.isDryRun) {
      return noop;
    }
    return cpy(files, target, opts);
  }

  bump(files, version) {
    this.log.exec('bump', files, version, this.isDryRun);
    debug({ command: 'bump', files, version });
    if (this.isDryRun) {
      return noop;
    }
    const sanitizedFiles = _.compact(_.castArray(files));
    const bumper = file => bumpFile(file, version).catch(() => this.log.warn(`Could not bump ${file}`));
    return Promise.all(sanitizedFiles.map(bumper));
  }
}

Shell.writes = { isWrite: true };

module.exports = Shell;
