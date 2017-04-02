const path = require('path'), 
  fs = require('fs'), 
  log = require('./log'), 
  config = require('./config'),
  util = require('./util'),
  globcp = require('./globcp'), 
  shell = require('shelljs'), 
  when = require('when'), 
  sequence = require('when/sequence'), 
  fn = require('when/node'), 
  noop = when.resolve(true);

const forcedCmdRe = /^!/;

function run(command, commandArgs) {

  const shellCommand = getShellCommand(command.replace(forcedCmdRe, '')), 
    cmd = [].slice.call(arguments).join(' '), 
    normalizedCmd = cmd.replace(forcedCmdRe, ''), 
    args = [].slice.call(arguments, 1), 
    silentState = shell.config.silent;

  shell.config.silent = !config.isVerbose;

  log.execution(normalizedCmd);

  if (normalizedCmd === cmd && config.isDryRun) {
    return noop;
  }

  return when.promise((resolve, reject) => {

    if(shellCommand === 'exec') {

      shell.exec(normalizedCmd, (code, output) => {
        if (code === 0) {
          resolve({
            code,
            output
          });
        } else {
          reject(output);
        }
      });

    } else if(shellCommand) {

      resolve(shell[shellCommand].apply(shell, args));

    } else {

      resolve(command.apply(null, args));

    }

    shell.config.silent = silentState;

  });

}

function runTemplateCommand(command) {
  return run(util.template(command, config.context));
}

function getShellCommand(command) {
  return command && command in shell && typeof shell[command] === 'function' ? command : 'exec';
}

function pushd(path) {
  return run('pushd', path);
}

function popd() {
  return run('popd');
}

function mkCleanDir(dir) {
  return sequence([
    run.bind(null, 'rm', '-rf', dir),
    run.bind(null, 'mkdir', '-p', dir)
  ]);
}

function build(command) {
  return command ? runTemplateCommand(command) : noop.then(() => {
    log.verbose('No build command was provided.');
  });
}

function npmPublish(path, tag) {
  const publishPath = path || '.';
  return run('npm', 'publish', publishPath, '--tag', tag);
}

function copy(files, options, target) {
  log.execution('copy', files, options, target);
  return !config.isDryRun ? globcp(files, options, target) : noop;
}

function bump(file, version) {
  if(file) {
    log.execution('bump', file, version);
  }
  if (!config.isDryRun && file !== false) {
    const files = typeof file === 'string' ? [file] : file;
    return when.map(files, file => fn.call(fs.readFile, path.resolve(file)).then(data => {
      const pkg = JSON.parse(data.toString());
      pkg.version = version;
      return pkg;
    }, err => {
      log.warn(`Could not read ${err.path || file}`);
      log.debug(err);
    }).then(data => {
      if(data){
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
