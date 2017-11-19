/* eslint-disable no-console */

const chalk = require('chalk');
const { config } = require('./config');

const log = console.log;

module.exports.log = log;

module.exports.info = (...args) => log(chalk.grey(...args));

module.exports.warn = (...args) => log(chalk.yellow('WARNING'), ...args);

module.exports.error = (...args) => log(chalk.red('ERROR'), ...args);

module.exports.exec = (...args) => (config.isVerbose || config.isDryRun) && log('$', ...args);

module.exports.verbose = (...args) => config.isVerbose && log(...args);

module.exports.dryRunMessage = () => log(chalk.grey('(not executed in dry run)'));
