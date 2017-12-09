const path = require('path');
const parseArgs = require('yargs-parser');
const _ = require('lodash');
const isCI = require('is-ci');
const defaultOptions = require('../conf/release-it.json');
const { debugConfig } = require('./debug');

const shortcutIncrements = ['major', 'minor', 'patch'];
const getFullIncrement = increment => (_.includes(shortcutIncrements, increment) ? `pre${increment}` : 'prerelease');

const LOCAL_CONFIG_PATH = path.resolve(process.cwd(), '.release-it.json');
const LOCAL_PACKAGE_PATH = path.resolve(process.cwd(), 'package.json');

const aliases = {
  c: 'config',
  d: 'dry-run',
  e: 'debug',
  f: 'force',
  h: 'help',
  i: 'increment',
  n: 'non-interactive',
  v: 'version',
  V: 'verbose'
};

const getLocalOptions = localConfigFile => {
  let localOptions = {};
  const localOptionsPath = localConfigFile ? path.resolve(localConfigFile) : LOCAL_CONFIG_PATH;

  try {
    localOptions = require(localOptionsPath);
  } catch (error) {
    if (localConfigFile || error.code !== 'MODULE_NOT_FOUND') {
      debugConfig(error);
      throw new Error(`File not found: ${localOptionsPath}`);
    }
  }

  return localOptions;
};

const getNpmPackageOptions = () => {
  let pkg = {};

  try {
    pkg = require(LOCAL_PACKAGE_PATH);
  } catch (err) {
    debugConfig(err);
    throw new Error(`File not found: ${LOCAL_PACKAGE_PATH}`);
  }

  return {
    version: pkg.version,
    name: pkg.name,
    private: pkg.private
  };
};

class Config {
  constructor(options = {}, args) {
    this.cliArguments = args ? this.parseCliArguments(args) : {};
    this.localOptions = getLocalOptions(options.config || this.cliArguments.config);
    this.defaultOptions = defaultOptions;
    this.npm = getNpmPackageOptions();
    this.options = this.mergeOptions(options);
    _.merge(this.options, this.getEnvironmentOptions());
  }

  parseCliArguments(args) {
    const cli = parseArgs(args, {
      boolean: true,
      alias: aliases
    });
    cli.increment = cli._[0] || cli.i;
    return this.parsePreReleaseArgument(cli);
  }

  parsePreReleaseArgument(cli) {
    if (cli.preRelease) {
      cli.increment = getFullIncrement(cli.increment);
      cli.preReleaseId = cli.preRelease;
      cli.npm = cli.npm || {};
      cli.npm.tag = cli.npm.tag || cli.preRelease;
      cli.github = cli.github || {};
      cli.github.preRelease = true;
    }
    return cli;
  }

  getEnvironmentOptions() {
    const { github } = this.options;
    return {
      github: {
        token: github.tokenRef ? process.env[github.tokenRef] : null
      }
    };
  }

  mergeOptions(options) {
    return _.defaultsDeep(
      {},
      this.cliArguments,
      options,
      {
        'non-interactive': isCI
      },
      this.localOptions,
      {
        name: this.npm.name || path.basename(process.cwd()),
        npm: this.npm
      },
      this.defaultOptions
    );
  }

  assignOptions(options) {
    this.options = _.merge(this.options, options);
  }

  getResolvedDir(key) {
    return path.resolve(_.get(this.options, key));
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
