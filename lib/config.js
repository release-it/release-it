import util from 'node:util';
import assert from 'node:assert';
import { isCI } from 'ci-info';
import defaultsDeep from '@nodeutils/defaults-deep';
import { isObjectStrict } from '@phun-ky/typeof';
import merge from 'lodash.merge';
import get from 'lodash.get';
import { promiseStateSync } from 'p-state';
import { loadConfig as loadC12 } from 'c12';
import { getSystemInfo, readJSON } from './util.js';

const debug = util.debug('release-it:config');
const defaultConfig = readJSON(new URL('../config/release-it.json', import.meta.url));

class Config {
  constructor(config = {}) {
    this.constructorConfig = config;
    this._loadOptions = loadOptions(config).then(({ options, localConfig }) => {
      this._options = options;
      this._localConfig = localConfig;
      debug(this._options);
    });
    this.contextOptions = {};
    debug({ system: getSystemInfo() });
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
    assert(promiseStateSync(this._loadOptions) === 'fulfilled', `The "options" not resolve yet`);
    return this._options;
  }

  get localConfig() {
    assert(promiseStateSync(this._loadOptions) === 'fulfilled', `The "localConfig" not resolve yet`);
    return this._localConfig;
  }

  get resolved() {
    return this._loadOptions;
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
  const file =
    (constructorConfig.config === false
      ? false
      : constructorConfig.config === true
        ? undefined
        : constructorConfig.config) ?? '.release-it';
  const dir = constructorConfig.configDir ?? process.cwd();
  const extend = constructorConfig.extends;

  if (file === false) return {};

  const resolvedConfig = await loadC12({
    name: 'release-it',
    configFile: file,
    packageJson: true,
    rcFile: false,
    envName: false,
    cwd: dir,
    defaultConfig: {
      extends: extend
    }
  }).catch(() => {
    throw new Error(`Invalid configuration file at ${file}`);
  });

  if (Object.keys(resolvedConfig.config).length === 0) {
    throw new Error(`no such file ${resolvedConfig.configFile}`);
  }

  debug('Loaded local config', resolvedConfig.config);
  return isObjectStrict(resolvedConfig.config) ? resolvedConfig.config : {};
}

export default Config;
