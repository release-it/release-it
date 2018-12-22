const cpy = require('cpy');
const sh = require('shelljs');
const _ = require('lodash');
const bumpFile = require('bump-file');
const isSubDir = require('@webpro/is-subdir');
const Log = require('./log');
const Config = require('./config');
const { debugShell } = require('./debug');
const { format } = require('./util');

const noop = Promise.resolve();

const forcedCmdRe = /^!/;

const IS_VERBOSE = (process.env.DEBUG || '').includes('release-it');

class Shell {
  constructor({ isVerbose = IS_VERBOSE, isDryRun = false, log, config } = {}) {
    this.isVerbose = isVerbose;
    this.isDryRun = isDryRun;
    this.log = log || new Log({ isVerbose, isDryRun });
    this.config = config || new Config();
  }

  run(command, options = {}) {
    const normalizedCmd = command.replace(forcedCmdRe, '');
    const program = normalizedCmd.split(' ')[0];
    const programArgs = normalizedCmd.split(' ').slice(1);
    const isSilent = sh.config.silent;
    const isVerbose = typeof options.verbose === 'boolean' ? options.verbose : this.isVerbose;

    this.log.exec(normalizedCmd);

    if (this.isDryRun && !options.isReadOnly) {
      this.log.dry();
      return noop;
    }

    return new Promise((resolve, reject) => {
      const cb = (code, stdout, stderr) => {
        stdout = stdout.toString().trim();
        debugShell({ command, options, code, stdout, stderr });
        sh.config.silent = isSilent;
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(stderr || stdout);
        }
      };

      if (program in sh && typeof sh[program] === 'function' && forcedCmdRe.test(command)) {
        sh.config.silent = !isVerbose;
        cb(0, sh[program](...programArgs));
      } else {
        sh.exec(normalizedCmd, { async: true, silent: !isVerbose }, cb);
      }
    });
  }

  runTemplateCommand(command, options) {
    const context = this.config.getOptions();
    return command ? this.run(format(command, context), options) : noop;
  }

  pushd(path) {
    return this.run(`!pushd ${path}`, { isReadOnly: true });
  }

  popd() {
    return this.run('!popd', { isReadOnly: true });
  }

  copy(files, options, target) {
    const opts = Object.assign(
      {
        parents: true,
        nodir: true
      },
      options
    );
    this.log.exec('copy', files, opts, target);
    if (this.isDryRun) {
      this.log.dry();
      return noop;
    }
    return cpy(files, target, opts);
  }

  bump(files, version) {
    this.log.exec('bump', files, version);
    if (this.isDryRun) {
      this.log.dry();
      return noop;
    }
    return files ? Promise.all(_.castArray(files).map(file => bumpFile(file, version))) : noop;
  }

  isSubDir(...args) {
    return isSubDir(...args);
  }
}

module.exports = Shell;
