/* eslint-disable no-console */

const util = require('util'),
  chalk = require('chalk'),
  config = require('./config');

function log() {
  console.log.apply(console, arguments);
}

function bold() {
  log(chalk.bold.apply(chalk, arguments));
}

function warn(message) {
  message = message.message || message;
  log(chalk.yellow('WARNING'), message);
}

function error(message) {
  message = message.message || message;
  log(chalk.red('ERROR'), message);
}

function dir(obj) {
  log(util.inspect(obj, { depth: null, colors: true }));
}

function verbose() {
  if(config.isVerbose) {
    log.apply(null, arguments);
  }
}

function verboseDir(obj) {
  if(config.isVerbose) {
    dir(obj);
  }
}

function debug() {
  if(config.isDebug) {
    log.apply(null, arguments);
  }
}

function debugDir(obj) {
  if(config.isDebug) {
    dir(obj);
  }
}

function execution() {
  const args = [].concat.apply([!config.isDryRun ? '[execute]' : '[dry-run]'], arguments);
  verbose.apply(this, args);
}

module.exports = {
  log,
  bold,
  warn,
  error,
  dir,
  verbose,
  verboseDir,
  debug,
  debugDir,
  execution
};
