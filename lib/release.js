const cli = require('./cli'),
  log = require('./log'),
  config = require('./config'),
  tasks = require('./tasks'),
  noop = Promise.resolve();

function fromCli(args) {
  return execute(config.parseArgs(args));
}

function execute(opts) {

  config.mergeOptions(opts);

  if(config.isShowVersion) {

    cli.version();

  } else if(config.isShowHelp) {

    cli.help();

  } else {

    if(config.isForce) {
      log.warn('Using --force, I sure hope you know what you are doing.');
    }

    if(config.isDebug) {
      require('when/monitor/console');
    }

    log.debugDir(config.options);

    return tasks.run(config.options).catch(error => {

      log.error(error);

      if(config.isDebug) {
        throw new Error(error);
      }

    });
  }

  return noop;
}

module.exports = {
  cli: fromCli,
  execute
};
