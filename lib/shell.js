const cpy = require('cpy');
const sh = require('shelljs');
const _ = require('lodash');
const bumpFile = require('bump-file');
const isSubDir = require('@webpro/is-subdir');
const { logExec, logDry } = require('./log');
const { debugShell } = require('./debug');
const { config } = require('./config');
const { format } = require('./util');

const noop = Promise.resolve();

const forcedCmdRe = /^!/;

const run = (command, options = {}) => {
  const normalizedCmd = command.replace(forcedCmdRe, '');
  const program = normalizedCmd.split(' ')[0];
  const programArgs = normalizedCmd.split(' ').slice(1);
  const isSilent = sh.config.silent;
  const isVerbose = typeof options.verbose === 'boolean' ? options.verbose : config.isVerbose;

  logExec(normalizedCmd);

  if (config.isDryRun && !options.isReadOnly) {
    logDry();
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
};

const runTemplateCommand = (command, options = { verbose: true }) => {
  return command ? run(format(command), options) : noop;
};

const pushd = path => run(`!pushd ${path}`, { isReadOnly: true });

const popd = () => run('!popd', { isReadOnly: true });

const copy = (files, options, target) => {
  const opts = Object.assign(
    {
      parents: true,
      nodir: true
    },
    options
  );
  logExec('copy', files, opts, target);
  if (config.isDryRun) {
    logDry();
    return noop;
  }
  return cpy(files, target, opts);
};

const bump = (files, version) => {
  logExec('bump', files, version);
  if (config.isDryRun) {
    logDry();
    return noop;
  }
  return files ? Promise.all(_.castArray(files).map(file => bumpFile(file, version))) : noop;
};

module.exports = {
  run,
  runTemplateCommand,
  pushd,
  popd,
  copy,
  isSubDir,
  bump
};
