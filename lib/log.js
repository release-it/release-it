var util = require('util'),
    chalk = require('chalk'),
    config = require('./config');

function log(message) {
    console.log.apply(console, arguments);
}

function bold(message) {
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
    log(util.inspect(obj));
}

function verbose(message) {
    if(config.isVerbose()) {
        log.apply(null, arguments);
    }
}

function verboseDir(obj) {
    if(config.isVerbose()) {
        dir(obj);
    }
}

function debug(message) {
    if(config.isDebug()) {
        log.apply(null, arguments);
    }
}

function debugDir(obj) {
    if(config.isDebug()) {
        dir(obj);
    }
}

function execution() {
    var args = [].concat.apply([!config.isDryRun() ? '[execute]' : '[dry-run]'], arguments);
    verbose.apply(this, args);
}

module.exports = {
    log: log,
    bold: bold,
    warn: warn,
    error: error,
    dir: dir,
    verbose: verbose,
    verboseDir: verboseDir,
    debug: debug,
    debugDir: debugDir,
    execution: execution
};
