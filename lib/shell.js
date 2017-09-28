import path from 'path';
import fs from 'fs';
import * as log from './log';
import { debugShell } from './debug';
import { config } from './config';
import * as util from './util';
import cpy from 'cpy';
import shell from 'shelljs';
import _ from 'lodash';
import tmp from 'tmp-promise';

const noop = Promise.resolve();

const forcedCmdRe = /^!/;

export function run(command, options = {}) {
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

    if (program in shell && typeof shell[program] === 'function' && !forcedCmdRe.test(command)) {
      shell.config.silent = !isVerbose;
      cb(0, shell[program](...programArgs));
    } else {
      shell.exec(normalizedCmd, { async: true, silent: !isVerbose }, cb);
    }
  });
}

export function runTemplateCommand(command, options = { verbose: true }) {
  return command ? run(util.template(command, config.options), options) : noop;
}

export function pushd(path) {
  return run(`pushd ${path}`, { isReadOnly: true });
}

export function popd() {
  return run('popd', { isReadOnly: true });
}

export function mkStageDir(stageDir) {
  log.exec(`mkdir (${stageDir})`);
  if (config.isDryRun) {
    return tmp.dir({ unsafeCleanup: true, template: '.tmp-XXXXXXXX' });
  } else if (stageDir) {
    return mkCleanDir(stageDir).then(() => ({
      path: stageDir,
      cleanup: () => run(`rm -rf ${stageDir}`)
    }));
  } else {
    return Promise.resolve({
      path: null,
      cleanup: noop
    });
  }
}

export function mkCleanDir(dir) {
  return run(`rm -rf ${dir}`).then(() => run(`mkdir -p ${dir}`));
}

export function npmPublish(options, pkgName) {
  const { publishPath, tag, access } = options;
  const isScopedPkg = pkgName.startsWith('@');
  const setAccess = isScopedPkg && access ? `--access ${access}` : '';
  return run(`npm publish ${publishPath} --tag ${tag} ${setAccess}`);
}

export function copy(files, options, target) {
  log.exec('copy', files, options, target);
  if (config.isDryRun) {
    log.dryRunMessage();
    return noop;
  }
  return cpy(files, target, options);
}

export function bump(files, version) {
  if (files) {
    return Promise.all(
      _.castArray(files).map(
        file =>
          new Promise((resolve, reject) => {
            fs.readFile(path.resolve(file), (err, data) => {
              if (err) {
                log.warn(`Could not read ${err.path || file}`);
                debugShell(err);
                return reject(err);
              }
              const pkg = JSON.parse(data.toString());
              pkg.version = version;
              log.exec('bump', file, version);
              if (config.isDryRun) {
                log.dryRunMessage();
                return resolve();
              }
              fs.writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`, err => {
                if (err) {
                  log.warn(`Could not bump version in ${file}`);
                  debugShell(err);
                  return reject(err);
                }
                return resolve(data);
              });
            });
          })
      )
    );
  }
}
