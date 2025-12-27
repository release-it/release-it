import util from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { isCI } from 'ci-info';
import defaultsDeep from '@nodeutils/defaults-deep';
import { isObjectStrict } from '@phun-ky/typeof';
import merge from 'lodash.merge';
import { loadConfig as loadC12 } from 'c12';
import { get, getSystemInfo, importModuleConfig, isLikelyPath, pathExists, readJSON } from './util.js';

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

  // Handle top-level string in package.json: "release-it": "<specifier>"
  const pkgPath = path.join(dir, 'package.json');

  // Prefer CLI --config over package.json "release-it" string
  if (fs.existsSync(pkgPath) && constructorConfig.config == null) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const rel = pkg && pkg['release-it'];
      if (typeof rel === 'string') {
        if (isLikelyPath(rel) || pathExists(dir, rel)) {
          if (/\.m?js$|\.cjs$/i.test(rel)) {
            const external = await importModuleConfig(path.resolve(dir, rel), dir);
            return external;
          }
          const loaded = await loadC12({
            name: 'release-it',
            configFile: rel,
            packageJson: false,
            rcFile: false,
            envName: false,
            cwd: dir,
            extend
          }).catch(() => {
            throw new Error(`Invalid configuration file at ${rel}`);
          });
          return loaded.config;
        } else {
          const external = await importModuleConfig(rel, dir);
          const expanded = await expandViaC12(external, dir, extend);
          return expanded;
        }
      }
    } catch {
      // ignore
    }
  }
  // If the user passed a non-path specifier via --config, treat it as an external module/package.
  if (typeof constructorConfig.config === 'string' && !isLikelyPath(constructorConfig.config) && !pathExists(dir, constructorConfig.config)) {
    const external = await importModuleConfig(constructorConfig.config, dir);
    const expanded = await expandViaC12(external, dir, extend);
    debug('Loaded external config from specifier', constructorConfig.config);
    return isObjectStrict(expanded) ? expanded : {};
  }

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

  let configObject = resolvedConfig.config;
  debug('Loaded local config', configObject);

  // If package.json "release-it" is a string, resolve it as an external specifier.
  if (typeof configObject === 'string') {
    const specifier = configObject;
    if (isLikelyPath(specifier) || pathExists(dir, specifier)) {
      // If specifier is a JS module, import it; otherwise let c12 parse non-JS formats.
      if (/\.m?js$|\.cjs$/i.test(specifier)) {
        const external = await importModuleConfig(path.resolve(dir, specifier), dir);
        configObject = external;
        debug('Loaded config from JS file specifier', specifier);
      } else {
        const loaded = await loadC12({
          name: 'release-it',
          configFile: specifier,
          packageJson: false,
          rcFile: false,
          envName: false,
          cwd: dir,
          extend
        }).catch(() => {
          throw new Error(`Invalid configuration file at ${specifier}`);
        });
        configObject = loaded.config;
        debug('Loaded config from file specifier', specifier);
      }
    } else {
      const external = await importModuleConfig(specifier, dir);
      configObject = await expandViaC12(external, dir, extend);
      debug('Loaded config from package specifier', specifier);
    }
  }

  return isObjectStrict(configObject) ? configObject : {};

  function resolveFile() {
    if (constructorConfig.config === false) return false;

    if (constructorConfig.config === true) return '.release-it';

    // If a bare specifier was passed, avoid pointing c12 to a non-existent file
    // and let our external module handling take care of it.
    if (typeof constructorConfig.config === 'string') {
      const spec = constructorConfig.config;
      if (!isLikelyPath(spec) && !pathExists(resolveDir(), spec)) {
        return '.release-it';
      }
    }
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

async function expandViaC12(baseConfig, dir, extend) {
  const loaded = await loadC12({
    name: 'release-it',
    configFile: false,
    packageJson: false,
    rcFile: false,
    envName: false,
    cwd: dir,
    extend,
    defaultConfig: baseConfig
  });
  return loaded.config;
}

export default Config;
