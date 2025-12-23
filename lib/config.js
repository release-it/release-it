import util from 'node:util';
import assert from 'node:assert';
import { isCI } from 'ci-info';
import defaultsDeep from '@nodeutils/defaults-deep';
import { isObjectStrict } from '@phun-ky/typeof';
import merge from 'lodash.merge';
import { loadConfig as loadC12 } from 'c12';
import { get, getSystemInfo, readJSON } from './util.js';

const debug = util.debug('release-it:config');
const defaultConfig = readJSON(new URL('../config/release-it.json', import.meta.url));

class Config {
  constructor(config = {}) {
    this.constructorConfig = config;
    this.contextOptions = {};
    debug({ system: getSystemInfo() });
  }

  async init() {
    await loadOptions(this.constructorConfig).then(({ options, localConfig }) => {
      this._options = options;
      this._localConfig = localConfig;
      debug(this._options);
    });
  }

  getContext(path) {
    const context = merge({}, this.options, this.contextOptions);
    return path ? get(context, path) : context;
  }

  setContext(options) {
    debug(options);
    merge(this.contextOptions, options);
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

  get options() {
    assert(this._options, `The "options" not resolve yet`);
    return this._options;
  }

  get localConfig() {
    assert(this._localConfig, `The "localConfig" not resolve yet`);
    return this._localConfig;
  }
}

async function loadOptions(constructorConfig) {
  const localConfig = await loadLocalConfig(constructorConfig);
  const merged = defaultsDeep(
    {},
    constructorConfig,
    {
      ci: isCI
    },
    localConfig,
    defaultConfig
  );
  const expanded = expandPreReleaseShorthand(merged);

  return {
    options: expanded,
    localConfig
  };
}

function expandPreReleaseShorthand(options) {
  const { increment, preRelease, preReleaseId, snapshot, preReleaseBase } = options;
  const isPreRelease = Boolean(preRelease) || Boolean(snapshot);
  const inc = snapshot ? 'prerelease' : increment;
  const preId = typeof preRelease === 'string' ? preRelease : typeof snapshot === 'string' ? snapshot : preReleaseId;
  options.version = {
    increment: inc,
    isPreRelease,
    preReleaseId: preId,
    preReleaseBase
  };
  if (typeof snapshot === 'string' && options.git) {
    // Pre set and hard code some options
    options.git.tagMatch = `0.0.0-${snapshot}.[0-9]*`;
    options.git.getLatestTagFromAllRefs = true;
    options.git.requireBranch = '!main';
    options.git.requireUpstream = false;
    options.npm.ignoreVersion = true;
  }
  return options;
}

async function loadLocalConfig(constructorConfig) {
  const file = resolveFile();
  const dir = resolveDir();
  const extend = resolveExtend();
  const defaultConfig = resolveDefaultConfig();

  if (file === false) return {};

  const resolvedConfig = await loadC12({
    name: 'release-it',
    configFile: file,
    packageJson: true,
    rcFile: false,
    envName: false,
    cwd: dir,
    extend,
    defaultConfig
  }).catch(() => {
    throw new Error(`Invalid configuration file at ${file}`);
  });

  debug('Loaded local config', resolvedConfig.config);
  return isObjectStrict(resolvedConfig.config) ? resolvedConfig.config : {};

  function resolveFile() {
    if (constructorConfig.config === false) return false;

    if (constructorConfig.config === true) return '.release-it';

    return constructorConfig.config ?? '.release-it';
  }

  function resolveDir() {
    return constructorConfig.configDir ?? process.cwd();
  }

  function resolveExtend() {
    return constructorConfig.extends === false ? false : undefined;
  }

  function resolveDefaultConfig() {
    return {
      extends: constructorConfig.extends === false ? undefined : constructorConfig.extends
    };
  }
}

export default Config;
