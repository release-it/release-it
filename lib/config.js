const { cosmiconfigSync } = require('cosmiconfig');
const parseJson = require('parse-json');
const parseToml = require('@iarna/toml/parse-string');
const yaml = require('yaml');
const _ = require('lodash');
const isCI = require('is-ci');
const debug = require('debug')('release-it:config');
const defaultConfig = require('../config/release-it.json');
const { getSystemInfo } = require('./util');

const searchPlaces = [
  'package.json',
  '.release-it.json',
  '.release-it.js',
  '.release-it.cjs',
  '.release-it.yaml',
  '.release-it.yml',
  '.release-it.toml'
];

const loaders = {
  '.json': (_, content) => parseJson(content),
  '.toml': (_, content) => parseToml(content),
  '.yaml': (_, content) => yaml.parse(content)
};

const getLocalConfig = localConfigFile => {
  let localConfig = {};
  if (localConfigFile === false) return localConfig;
  const explorer = cosmiconfigSync('release-it', {
    searchPlaces,
    loaders
  });
  const result = localConfigFile ? explorer.load(localConfigFile) : explorer.search();
  if (result && typeof result.config === 'string') {
    throw new Error(`Invalid configuration file at ${result.filepath}`);
  }
  debug({ cosmiconfig: result });
  return result && _.isPlainObject(result.config) ? result.config : localConfig;
};

class Config {
  constructor(config = {}) {
    this.constructorConfig = config;
    this.localConfig = getLocalConfig(config.config);
    this.options = this.mergeOptions();
    this.options = this.expandPreReleaseShorthand(this.options);
    this.contextOptions = {};
    debug({ system: getSystemInfo() });
    debug(this.options);
  }

  expandPreReleaseShorthand(options) {
    const { increment, preRelease, preReleaseId } = options;
    if (options.github.release && increment === false) {
      console.warn('Using --no-increment with --github.release is deprecated. Add --github.update in release-it v15.');
      options.github.update = increment === false;
    }
    options.version = {
      increment,
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
        ci: isCI
      },
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

  setCI(value = true) {
    this.options.ci = value;
  }

  get defaultConfig() {
    return defaultConfig;
  }

  get isDryRun() {
    return Boolean(this.options['dry-run']);
  }

  get isIncrement() {
    return this.options.increment !== false;
  }

  get isVerbose() {
    return Boolean(this.options.verbose);
  }

  get verbosityLevel() {
    return this.options.verbose;
  }

  get isDebug() {
    return debug.enabled;
  }

  get isCI() {
    return Boolean(this.options.ci) || this.isReleaseVersion;
  }

  get isPromptOnlyVersion() {
    return this.options['only-version'];
  }

  get isReleaseVersion() {
    return Boolean(this.options['release-version']);
  }

  get isCollectMetrics() {
    return !this.options['disable-metrics'];
  }
}

module.exports = Config;
