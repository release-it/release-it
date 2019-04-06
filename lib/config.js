const path = require('path');
const _ = require('lodash');
const isCI = require('is-ci');
const defaultConfig = require('../conf/release-it.json');
const { FileNotFoundError } = require('./errors');
const debug = require('debug')('release-it:config');

const LOCAL_CONFIG_FILE = '.release-it.json';
const LOCAL_PACKAGE_FILE = 'package.json';

const getLocalConfig = localConfigFile => {
  let localConfig = {};
  if (localConfigFile === false) return localConfig;
  const localConfigPath = path.resolve(localConfigFile || LOCAL_CONFIG_FILE);
  try {
    localConfig = require(localConfigPath);
  } catch (err) {
    debug(err);
    if (!localConfigFile && err.code === 'MODULE_NOT_FOUND') return {};
    if (err.code === 'MODULE_NOT_FOUND') throw new FileNotFoundError(localConfigPath);
    throw err;
  }
  return localConfig;
};

const getNpmPackageManifest = manifestFile => {
  let npm = {};
  if (manifestFile === false) return npm;
  const manifestPath = path.resolve(manifestFile || LOCAL_PACKAGE_FILE);
  try {
    npm = require(manifestPath);
  } catch (err) {
    debug(err);
  }
  return npm;
};

class Config {
  constructor(config = {}) {
    this.constructorConfig = config;
    this.localConfig = getLocalConfig(config.config);
    this.localPackageManifest = getNpmPackageManifest(config.manifest);
    this.options = this.mergeOptions();
    this.options = this.expandPreReleaseShorthand(this.options);
    this.contextOptions = {};
    debug(this.options);
  }

  expandPreReleaseShorthand(options) {
    const { increment, preRelease, preReleaseId } = options;
    options.version = {
      increment: !increment && !this.isInteractive ? 'patch' : increment,
      isPreRelease: Boolean(preRelease),
      preReleaseId: typeof preRelease === 'string' ? preRelease : preReleaseId
    };
    return options;
  }

  mergeOptions() {
    return _.defaultsDeep(
      {},
      this.constructorConfig,
      {
        'non-interactive': isCI || undefined
      },
      this.localPackageManifestConfig,
      this.localConfig,
      this.defaultConfig
    );
  }

  getContext(path) {
    const context = _.merge({}, this.options, this.contextOptions);
    return path ? _.get(context, path) : context;
  }

  setContext(options) {
    debug(options);
    _.merge(this.contextOptions, options);
  }

  get defaultConfig() {
    return defaultConfig;
  }

  get localPackageManifestConfig() {
    return this.localPackageManifest['release-it'] || {};
  }

  get isDryRun() {
    return Boolean(this.options['dry-run']);
  }

  get isVerbose() {
    return Boolean(this.options.verbose);
  }

  get isDebug() {
    return debug.enabled;
  }

  get isInteractive() {
    return !this.options['non-interactive'];
  }

  get isCollectMetrics() {
    return !this.options['disable-metrics'];
  }
}

module.exports = Config;
