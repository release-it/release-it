const cosmiconfig = require('cosmiconfig');
const parseToml = require('@iarna/toml/parse-string');
const _ = require('lodash');
const isCI = require('is-ci');
const debug = require('debug')('release-it:config');
const defaultConfig = require('../conf/release-it.json');
const { InvalidConfigurationError } = require('./errors');

const searchPlaces = [
  'package.json',
  '.release-it.json',
  '.release-it.js',
  '.release-it.yaml',
  '.release-it.yml',
  '.release-it.toml'
];

const getLocalConfig = localConfigFile => {
  let localConfig = {};
  if (localConfigFile === false) return localConfig;
  const explorer = cosmiconfig('release-it', {
    searchPlaces,
    loaders: {
      '.toml': (_, content) => parseToml(content)
    }
  });
  const result = localConfigFile ? explorer.loadSync(localConfigFile) : explorer.searchSync();
  if (result && typeof result.config === 'string') {
    throw new InvalidConfigurationError(result.filepath);
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
    debug(this.options);
  }

  expandPreReleaseShorthand(options) {
    const { increment, preRelease, preReleaseId } = options;
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
        ci: isCI || undefined
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

  get defaultConfig() {
    return defaultConfig;
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

  get isCI() {
    const { ci, 'non-interactive': nonInteractive } = this.options;
    return typeof nonInteractive === 'boolean' ? nonInteractive : Boolean(ci);
  }

  get isCollectMetrics() {
    return !this.options['disable-metrics'];
  }
}

module.exports = Config;
