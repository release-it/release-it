'use strict';

const path = require('path'),
  parseArgs = require('minimist'),
  _ = require('lodash'),
  fixDeprecatedOptions = require('./deprecated');

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '..', 'conf', 'release.json'),
  LOCAL_CONFIG_PATH = path.resolve(process.cwd(), '.release.json'),
  LOCAL_PACKAGE_PATH = path.resolve(process.cwd(), 'package.json');

const defaultOptions = require(DEFAULT_CONFIG_PATH);

const aliases = {
  c: 'config',
  d: 'dry-run',
  e: 'debug',
  f: 'force',
  g: 'github.release',
  h: 'help',
  i: 'increment',
  m: 'message',
  n: 'non-interactive',
  p: 'npm.publish',
  v: 'version',
  V: 'verbose'
};

function getLocalOptions(localConfigFile) {
  var localOptions = {};
  const localOptionsPath = localConfigFile ? path.resolve(process.cwd(), localConfigFile) : LOCAL_CONFIG_PATH;

  try {
    localOptions = require(localOptionsPath);
  } catch(error) {
    if(localConfigFile) {
      throw new Error(`Cannot find provided local configuration file: ${localOptionsPath}`);
    } else if(error.code !== 'MODULE_NOT_FOUND') {
      throw new Error(`Could not load configuration file: ${localOptionsPath}\n${error}`);
    }
  }

  localOptions.pkgFiles = _.isArray(localOptions.pkgFiles) && localOptions.pkgFiles.length === 0 ? false : localOptions.pkgFiles;

  return localOptions;
}

function getNpmPackageOptions() {

  var pkg = {};

  try {
    pkg = require(LOCAL_PACKAGE_PATH);
  } catch(error) {
    pkg = {};
  }

  return {
    version: pkg.version,
    name: pkg.name,
    private: pkg.private
  }

}

function getDefaultOptions() {
  return defaultOptions;
}

class Config {

  constructor() {
    this.cliArguments = {};
    this.localOptions = {};
    this.npmPackageOptions = getNpmPackageOptions();
    this.defaultOptions = getDefaultOptions();
    this.runtimeOptions = {};
  }

  parseArgs(args) {
    const cli = parseArgs(args, {
      boolean: true,
      alias: aliases
    });
    cli.increment = cli.i = (cli._[0] || cli.i);
    cli.src = _.extend({commitMessage: cli.message}, cli.src);
    cli.dist = _.extend({commitMessage: cli.message}, cli.dist);
    this.cliArguments = cli;
  }

  mergeOptions(options) {

    options = options || {};

    this.localOptions = getLocalOptions(options.config || this.cliArguments.config);

    const mergedOptions = _.defaultsDeep(
      {},
      this.cliArguments,
      options,
      this.localOptions,
      { npm: this.npmPackageOptions },
      this.defaultOptions
    );

    mergedOptions.name = this.npmPackageOptions.name || path.basename(process.cwd());

    mergedOptions.verbose = mergedOptions['non-interactive'] || mergedOptions.debug || mergedOptions.verbose;

    this.options = fixDeprecatedOptions(mergedOptions);

  }

  getRuntimeOption(key) {
    return this.runtimeOptions[key];
  }

  setRuntimeOption(key, value) {
    if(this.isDebug) {
      const loggedValue = key === 'github_token' ? '********' : value;
      console.log(`[debug] Setting runtime option "${key}" to`, loggedValue);
    }
    this.runtimeOptions[key] = value;
  }

  get context() {
    return _.extend({}, this.options, this.runtimeOptions);
  }

  get isDebug() {
    return this.options.debug;
  }

  get isDryRun() {
    return this.options['dry-run'];
  }

  get isForce() {
    return this.options.force;
  }

  get isVerbose() {
    return this.options.verbose;
  }

  get isShowVersion() {
    return this.options.version;
  }

  get isShowHelp() {
    return this.options.help;
  }

}

module.exports = new Config();
