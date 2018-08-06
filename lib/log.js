const chalk = require('chalk');
const { config } = require('./config');

const MOVE_LEFT = new Buffer('1b5b3130303044', 'hex').toString();
const CLEAR_LINE = new Buffer('1b5b304b', 'hex').toString();

const { log, error } = console;

const clearLine = config.isInteractive ? '' : MOVE_LEFT + CLEAR_LINE;

module.exports.log = log;

module.exports.info = (...args) => log(clearLine + chalk.grey(...args));

module.exports.warn = (...args) => log(clearLine + chalk.yellow('WARNING'), ...args);

module.exports.verbose = (...args) => config.isVerbose && log(...args);

module.exports.logError = (...args) => error(clearLine + chalk.red('ERROR'), ...args);

module.exports.logExec = (...args) => (config.isVerbose || config.isDryRun) && log('$', ...args);

module.exports.logDry = () => log(chalk.grey('(not executed in dry run)'));
