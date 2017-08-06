const path = require('path'),
  fs = require('fs'),
  log = require('./log'),
  config = require('./config'),
  util = require('./util'),
  globcp = require('./globcp'),
  shell = require('shelljs'),
  when = require('when'),
  fn = require('when/node'),
  noop = Promise.resolve();

const forcedCmdRe = /^!/;

function run(command, options) { // eslint-disable-line no-unused-vars

  options = options || {};

  const normalizedCmd = command.replace(forcedCmdRe, '');
  const program = normalizedCmd.split(' ')[0];
  const programArgs = normalizedCmd.split(' ').slice(1);
  const isSilent = shell.config.silent;

  log.execution(normalizedCmd);

  if(config.isDryRun && !options.isReadOnly) {
    return noop;
  }

  return new Promise((resolve, reject) => {

    const cb = (code, stdout, stderr) => {
      log.debug({command, options, code, stdout: stdout.toString(), stderr});
      shell.config.silent = isSilent;
      if(code === 0) {
        resolve(stdout);
      } else {
        reject(stderr);
      }
    };

    if(program in shell && typeof shell[program] === 'function' && !forcedCmdRe.test(command)) {
      shell.config.silent = !config.isVerbose;
      cb(0, shell[program].apply(shell, programArgs));
    } else {
      shell.exec(normalizedCmd, {async: true, silent: !config.isVerbose}, cb);
    }

  });

}

function runTemplateCommand(command) {
  return run(util.template(command, config.context));
}

function pushd(path) {
  return run(`pushd ${path}`, {isReadOnly: true});
}

function popd() {
  return run('popd', {isReadOnly: true});
}

function mkCleanDir(dir) {
  return run(`rm -rf ${dir}`).then(() => run(`mkdir -p ${dir}`));
}

function build(command) {
  return command ? runTemplateCommand(command) : noop.then(() => {
    log.verbose('No build command was provided.');
  });
}

function npmPublish(path, tag) {
  const publishPath = path || '.';
  return run(`npm publish ${publishPath} --tag ${tag}`);
}

function copy(files, options, target) {
  log.execution('copy', files, options, target);
  return !config.isDryRun ? globcp(files, options, target) : noop;
}

function bump(file, version) {
  if(file) {
    log.execution('bump', file, version);
  }
  if(!config.isDryRun && file !== false) {
    const files = typeof file === 'string' ? [file] : file;
    return when.map(files, file => fn.call(fs.readFile, path.resolve(file)).then(data => {
      const pkg = JSON.parse(data.toString());
      pkg.version = version;
      return pkg;
    }, err => {
      log.warn(`Could not read ${err.path || file}`);
      log.debug(err);
    }).then(data => {
      if(data) {
        return fn.call(fs.writeFile, file, `${JSON.stringify(data, null, 2)}\n`);
      }
    }).catch(err => {
      log.warn(`Could not bump version in ${file}`);
      log.debug(err);
    }));
  } else {
    return noop;
  }
}

module.exports = {
  run,
  runTemplateCommand,
  pushd,
  popd,
  mkCleanDir,
  build,
  npmPublish,
  copy,
  bump
};
