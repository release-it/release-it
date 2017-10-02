/* eslint-disable no-console */

import chalk from 'chalk';
import { config } from './config';

export const log = console.log;

export const info = (...args) => log(chalk.grey(...args));

export const warn = (...args) => log(chalk.yellow('WARNING'), ...args);

export const error = (...args) => log(chalk.red('ERROR'), ...args);

export const exec = (...args) => (config.isVerbose || config.isDryRun) && log('$', ...args);

export const verbose = (...args) => config.isVerbose && log(...args);

export const dryRunMessage = () => log(chalk.grey('(not executed in dry run)'));
