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
    this.constructorConfig = this.expandShorthands(config);
    this.localConfig = getLocalConfig(config.config);
    this.localPackageManifest = getNpmPackageManifest(config.manifest);
    this.options = this._mergeOptions();
    this.runtimeOptions = {};
    if (!this.options.increment && !this.isInteractive && !this.options.preRelease) {
      this.options.increment = 'patch';
    }
    debug(this.getOptions());
  }

  expandShorthands(options) {
    return this.expandNoGitShorthand(this.expandPreReleaseShorthand(options));
  }

  expandNoGitShorthand(options) {
    const { git } = options;
    if (git === false) {
      options.use = 'pkg.version';
      options.git = {
        skip: true,
        commit: false,
        tag: false,
        push: false
      };
    }
    return options;
  }

  expandPreReleaseShorthand(options) {
    const { preRelease } = options;
    if (preRelease) {
      const preReleaseId = preRelease === true ? undefined : preRelease;
      options.preReleaseId = preReleaseId;
      options.preRelease = !!preRelease;
      options.npm = options.npm || {};
      options.npm.tag = options.npm.tag || preReleaseId;
    }
    return options;
  }

  _mergeOptions() {
    return _.defaultsDeep(
      {},
      this.constructorConfig,
      {
        'non-interactive': isCI || undefined
      },
      this.localPackageManifestConfig,
      this.localConfig,
      {
        name: this.npmConfig.name || path.basename(process.cwd()),
        npm: this.npmConfig
      },
      this.defaultConfig
    );
  }

  getOptions() {
    return Object.assign({}, this.options, this.runtimeOptions);
  }

  setRuntimeOptions(options) {
    Object.assign(this.runtimeOptions, options);
  }

  get defaultConfig() {
    return defaultConfig;
  }

  get npmConfig() {
    const { version, name, private: isPrivate, publishConfig } = this.localPackageManifest;
    return {
      version,
      name,
      private: isPrivate,
      publish: !!name,
      publishConfig
    };
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
