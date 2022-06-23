import util from 'node:util';
import { cosmiconfigSync } from 'cosmiconfig';
import parseToml from '@iarna/toml/parse-string.js';
import _ from 'lodash';
import isCI from 'is-ci';
import { readJSON, getSystemInfo } from './util.js';

const debug = util.debug('release-it:config');
const defaultConfig = readJSON(new URL('../config/release-it.json', import.meta.url));

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
  '.toml': (_, content) => parseToml(content)
};

const getLocalConfig = ({ file, dir = process.cwd() }) => {
  let localConfig = {};
  if (file === false) return localConfig;
  const explorer = cosmiconfigSync('release-it', {
    searchPlaces,
    loaders
  });
  const result = file ? explorer.load(file) : explorer.search(dir);
  if (result && typeof result.config === 'string') {
    throw new Error(`Invalid configuration file at ${result.filepath}`);
  }
  debug({ cosmiconfig: result });
  return result && _.isPlainObject(result.config) ? result.config : localConfig;
};

class Config {
  constructor(config = {}) {
    this.constructorConfig = config;
    this.localConfig = getLocalConfig({ file: config.config, dir: config.configDir });
    this.options = this.mergeOptions();
    this.options = this.expandPreReleaseShorthand(this.options);
    this.contextOptions = {};
    debug({ system: getSystemInfo() });
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
    return Boolean(this.options.ci) || this.isReleaseVersion || this.isChangelog;
  }

  get isPromptOnlyVersion() {
    return this.options['only-version'];
  }

  get isReleaseVersion() {
    return Boolean(this.options['release-version']);
  }

  get isChangelog() {
    return Boolean(this.options['changelog']);
  }
}

export default Config;
