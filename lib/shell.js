const cpy = require('cpy');
const shell = require('shelljs');
const _ = require('lodash');
const tmp = require('tmp-promise');
const bumpFile = require('bump-file');
const log = require('./log');
const { debugShell } = require('./debug');
const { config } = require('./config');
const util = require('./util');

const noop = Promise.resolve();

const forcedCmdRe = /^!/;

const run = (command, options = {}) => {
  const normalizedCmd = command.replace(forcedCmdRe, '');
  const program = normalizedCmd.split(' ')[0];
  const programArgs = normalizedCmd.split(' ').slice(1);
  const isSilent = shell.config.silent;
  const isVerbose = typeof options.verbose === 'boolean' ? options.verbose : config.isVerbose;

  log.exec(normalizedCmd);

  if (config.isDryRun && !options.isReadOnly) {
    log.dryRunMessage();
    return noop;
  }

  return new Promise((resolve, reject) => {
    const cb = (code, stdout, stderr) => {
      stdout = stdout.toString().trim();
      debugShell({ command, options, code, stdout, stderr });
      shell.config.silent = isSilent;
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr));
      }
    };

    if (program in shell && typeof shell[program] === 'function' && forcedCmdRe.test(command)) {
      shell.config.silent = !isVerbose;
      cb(0, shell[program](...programArgs));
    } else {
      shell.exec(normalizedCmd, { async: true, silent: !isVerbose }, cb);
    }
  });
};

const runTemplateCommand = (command, options = { verbose: true }) => {
  return command ? run(util.template(command, config.options), options) : noop;
};

const pushd = path => {
  return run(`!pushd ${path}`, { isReadOnly: true });
};

const popd = () => {
  return run('!popd', { isReadOnly: true });
};

const mkTmpDir = dir => {
  log.exec(`mkdir (${dir})`);
  if (config.isDryRun) {
    return tmp.dir({ unsafeCleanup: true, template: '.tmp-XXXXXXXX' });
  } else if (dir) {
    return mkCleanDir(dir).then(() => ({
      path: dir,
      cleanup: () => run(`!rm -rf ${dir}`)
    }));
  } else {
    return Promise.resolve({
      path: null,
      cleanup: noop
    });
  }
};

const mkCleanDir = dir => {
  return run(`!rm -rf ${dir}`).then(() => run(`!mkdir -p ${dir}`));
};

const npmPublish = (options, pkgName) => {
  const { publishPath, tag, access } = options;
  const isScopedPkg = pkgName.startsWith('@');
  const setAccess = isScopedPkg && access ? `--access ${access}` : '';
  return run(`npm publish ${publishPath} --tag ${tag} ${setAccess}`);
};

const copy = (files, options, target) => {
  log.exec('copy', files, options, target);
  if (config.isDryRun) {
    log.dryRunMessage();
    return noop;
  }
  return cpy(files, target, options);
};

const bump = (files, version) => {
  if (config.isDryRun) {
    log.dryRunMessage();
    return noop;
  }
  return files
    ? Promise.all(
        _.castArray(files).map(file => {
          log.exec('bump', file, version);
          return bumpFile(file, version);
        })
      )
    : noop;
};

module.exports = {
  run,
  runTemplateCommand,
  pushd,
  popd,
  mkTmpDir,
  mkCleanDir,
  npmPublish,
  copy,
  bump
};
