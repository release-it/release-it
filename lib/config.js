const path = require('path');
const parseArgs = require('yargs-parser');
const _ = require('lodash');
const isCI = require('is-ci');
const defaultConfig = require('../conf/release-it.json');
const { FileNotFoundError } = require('./errors');
const { debugConfig } = require('./debug');

const LOCAL_CONFIG_PATH = path.resolve(process.cwd(), '.release-it.json');
const LOCAL_PACKAGE_PATH = path.resolve(process.cwd(), 'package.json');

const aliases = {
  c: 'config',
  d: 'dry-run',
  e: 'debug',
  h: 'help',
  i: 'increment',
  n: 'non-interactive',
  v: 'version',
  V: 'verbose'
};

const getLocalConfig = localConfigFile => {
  let localConfig = {};
  const localConfigPath = localConfigFile ? path.resolve(localConfigFile) : LOCAL_CONFIG_PATH;

  try {
    localConfig = require(localConfigPath);
  } catch (error) {
    debugConfig(error);
    if (!localConfigFile && error.code === 'MODULE_NOT_FOUND') return;
    if (error.code === 'MODULE_NOT_FOUND') throw new FileNotFoundError(localConfigPath);
    throw error;
  }

  return localConfig;
};

const getNpmPackageManifest = () => {
  let npm = {};
  try {
    npm = require(LOCAL_PACKAGE_PATH);
  } catch (err) {
    debugConfig(err);
  }
  return npm;
};

class Config {
  constructor(constructorConfig = {}, cliArguments) {
    this.cliArguments = cliArguments ? this.parseCliArguments(cliArguments) : {};
    this.localConfig = getLocalConfig(constructorConfig.config || this.cliArguments.config);
    this.localPackageManifest = getNpmPackageManifest();
    this.options = this.mergeOptions(constructorConfig);
  }

  parseCliArguments(args) {
    const cli = parseArgs(args, {
      boolean: true,
      alias: aliases,
      default: {
        'dry-run': false,
        verbose: false
      },
      configuration: {
        'parse-numbers': false
      }
    });
    cli.increment = cli._[0] || cli.i;
    if (!cli.increment && cli.nonInteractive && !cli.preRelease) {
      cli.increment = 'patch';
    }
    return this.parsePreReleaseArgument(cli);
  }

  parsePreReleaseArgument(cli) {
    const { preRelease } = cli;
    if (preRelease) {
      const preReleaseId = preRelease === true ? undefined : preRelease;
      cli.preReleaseId = preReleaseId;
      cli.preRelease = !!preRelease;
      cli.npm = cli.npm || {};
      cli.npm.tag = cli.npm.tag || preReleaseId;
      cli.github = cli.github || {};
      cli.github.preRelease = true;
    }
    return cli;
  }

  mergeOptions(options) {
    return _.defaultsDeep(
      {},
      this.cliArguments,
      options,
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

  assignOptions(options) {
    this.options = _.merge(this.options, options);
  }

  setOption(key, value) {
    _.set(this.options, key, value);
  }

  getOption(key) {
    return _.get(this.options, key);
  }

  get defaultConfig() {
    return defaultConfig;
  }

  get npmConfig() {
    const { version, name, private: isPrivate } = this.localPackageManifest;
    return {
      version,
      name,
      private: isPrivate,
      publish: !!name
    };
  }

  get localPackageManifestConfig() {
    return this.localPackageManifest['release-it'] || {};
  }

  get githubToken() {
    return _.get(process.env, this.options.github.tokenRef, null);
  }

  get isDryRun() {
    return this.options['dry-run'];
  }

  get isVerbose() {
    return this.options.verbose;
  }

  get isDebug() {
    return this.options.debug;
  }

  get isInteractive() {
    return !this.options['non-interactive'];
  }

  get isShowVersion() {
    return !!this.options.version;
  }

  get isShowHelp() {
    return !!this.options.help;
  }

  get isCollectMetrics() {
    return !this.options['disable-metrics'];
  }
}

module.exports.Config = Config;
module.exports.config = new Config({}, [].slice.call(process.argv, 2));
