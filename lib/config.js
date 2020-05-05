const { cosmiconfigSync } = require('cosmiconfig');
const parseJson = require('parse-json');
const parseToml = require('@iarna/toml/parse-string');
const yaml = require('yaml');
const _ = require('lodash');
const isCI = require('is-ci');
const debug = require('debug')('release-it:config');
const defaultConfig = require('../config/release-it.json');
const { InvalidConfigurationError } = require('./errors');
const { getSystemInfo } = require('./util');

const searchPlaces = [
  'package.json',
  '.release-it.json',
  '.release-it.js',
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
    debug({ system: getSystemInfo() });
    debug(this.options);
  }

  expandPreReleaseShorthand(options) {
    const { increment, preRelease, preReleaseId } = options;
    options.isUpdate = increment === false;
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
        // FIXME: temp solution for https://github.com/watson/ci-info/issues/48
        ci: isCI || Boolean(process.env.GITHUB_ACTIONS) || undefined
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

  get verbosityLevel() {
    return this.options.verbose;
  }

  get isDebug() {
    return debug.enabled;
  }

  get isCI() {
    return Boolean(this.options.ci);
  }

  get isCollectMetrics() {
    return !this.options['disable-metrics'];
  }
}

module.exports = Config;
