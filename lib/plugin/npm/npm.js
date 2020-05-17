const path = require('path');
const semver = require('semver');
const urlJoin = require('url-join');
const Plugin = require('../Plugin');
const { hasAccess, rejectAfter, parseVersion } = require('../../util');
const prompts = require('./prompts');

const options = { write: false };

const MANIFEST_PATH = './package.json';
const REGISTRY_TIMEOUT = 10000;
const DEFAULT_TAG = 'latest';
const DEFAULT_TAG_PRERELEASE = 'next';
const NPM_BASE_URL = 'https://www.npmjs.com';

class npm extends Plugin {
  static isEnabled(options) {
    return hasAccess(MANIFEST_PATH) && options !== false;
  }

  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
  }

  async init() {
    const { name, version: latestVersion, private: isPrivate, publishConfig } = require(path.resolve(MANIFEST_PATH));
    this.setContext({ name, latestVersion, private: isPrivate, publishConfig });

    if (this.options.publish === false || isPrivate) return;

    if (this.options.skipChecks) return;

    const validations = Promise.all([this.isRegistryUp(), this.isAuthenticated(), this.getLatestRegistryVersion()]);

    await Promise.race([validations, rejectAfter(REGISTRY_TIMEOUT)]);

    const [isRegistryUp, isAuthenticated, latestVersionInRegistry] = await validations;

    if (!isRegistryUp) {
      throw new Error(`Unable to reach npm registry (timed out after ${REGISTRY_TIMEOUT}ms).`);
    }

    if (!isAuthenticated) {
      throw new Error('Not authenticated with npm. Please `npm login` and try again.');
    }

    if (!latestVersionInRegistry) {
      this.log.warn('No version found in npm registry. Assuming new package.');
    } else {
      if (!semver.eq(latestVersion, latestVersionInRegistry)) {
        this.log.warn(
          `Latest version in registry (${latestVersionInRegistry}) does not match package.json (${latestVersion}).`
        );
      }
    }
  }

  getName() {
    return this.getContext('name');
  }

  getLatestVersion() {
    return this.options.ignoreVersion ? null : this.getContext('latestVersion');
  }

  async bump(version) {
    const task = () =>
      this.exec(`npm version ${version} --no-git-tag-version`).catch(err => {
        if (/version not changed/i.test(err)) {
          this.log.warn(`Did not update version in package.json, etc. (already at ${version}).`);
        } else {
          return false;
        }
      });
    const tag = this.options.tag || (await this.resolveTag(version));
    this.setContext({ version, tag });
    return this.spinner.show({ task, label: 'npm version' });
  }

  release() {
    if (this.options.publish === false) return false;
    const publish = () => this.publish({ otpCallback });
    const otpCallback = this.global.isCI ? null : task => this.step({ prompt: 'otp', task });
    return this.step({ task: publish, label: 'npm publish', prompt: 'publish' });
  }

  isRegistryUp() {
    const registry = this.getRegistry();
    const registryArg = registry ? ` --registry ${registry}` : '';
    return this.exec(`npm ping${registryArg}`).then(
      () => true,
      err => {
        if (/code E40[04]|404.*(ping not found|No content for path)/.test(err)) {
          this.log.warn('Ignoring unsupported `npm ping` command response.');
          return true;
        }
        return false;
      }
    );
  }

  isAuthenticated() {
    const registry = this.getRegistry();
    const registryArg = registry ? ` --registry ${registry}` : '';
    return this.exec(`npm whoami${registryArg}`).then(
      () => true,
      err => {
        this.debug(err);
        if (/code E40[04]/.test(err)) {
          this.log.warn('Ignoring unsupported `npm whoami` command response.');
          return true;
        }
        return false;
      }
    );
  }

  async getLatestRegistryVersion() {
    const registry = this.getRegistry();
    const registryArg = registry ? ` --registry ${registry}` : '';
    const name = this.getName();
    const latestVersion = this.getLatestVersion();
    const tag = await this.resolveTag(latestVersion);
    return this.exec(`npm show ${name}@${tag} version${registryArg}`, { options }).catch(() => null);
  }

  getRegistryPreReleaseTags() {
    return this.exec(`npm view ${this.getName()} dist-tags --json`, { options }).then(
      output => {
        try {
          const tags = JSON.parse(output);
          return Object.keys(tags).filter(tag => tag !== DEFAULT_TAG);
        } catch (err) {
          this.debug(err);
          return [];
        }
      },
      () => []
    );
  }

  getPackageUrl() {
    const baseUrl = this.getRegistry() || NPM_BASE_URL;
    return urlJoin(baseUrl, 'package', this.getName());
  }

  getRegistry() {
    const { publishConfig } = this.getContext();
    const registries = publishConfig
      ? publishConfig.registry
        ? [publishConfig.registry]
        : Object.keys(publishConfig)
            .filter(key => key.endsWith('registry'))
            .map(key => publishConfig[key])
      : [];
    return registries[0];
  }

  async guessPreReleaseTag() {
    const [tag] = await this.getRegistryPreReleaseTags();
    if (tag) {
      return tag;
    } else {
      this.log.warn(`Unable to get pre-release tag(s) from npm registry. Using "${DEFAULT_TAG_PRERELEASE}".`);
      return DEFAULT_TAG_PRERELEASE;
    }
  }

  async resolveTag(version) {
    const { tag } = this.options;
    const { isPreRelease, preReleaseId } = parseVersion(version);
    if (!isPreRelease) {
      return DEFAULT_TAG;
    } else {
      return tag || preReleaseId || (await this.guessPreReleaseTag());
    }
  }

  async publish({ otp = this.options.otp, otpCallback } = {}) {
    const { publishPath = '.', access } = this.options;
    const { name, private: isPrivate, tag = DEFAULT_TAG } = this.getContext();
    const isScopedPkg = name.startsWith('@');
    const accessArg = isScopedPkg && access ? `--access ${access}` : '';
    const otpArg = otp ? `--otp ${otp}` : '';
    const dryRunArg = this.global.isDryRun ? '--dry-run' : '';
    if (isPrivate) {
      this.log.warn('Skip publish: package is private.');
      return false;
    }
    return this.exec(`npm publish ${publishPath} --tag ${tag} ${accessArg} ${otpArg} ${dryRunArg}`, { options })
      .then(() => {
        this.setContext({ isReleased: true });
      })
      .catch(err => {
        this.debug(err);
        if (/one-time pass/.test(err)) {
          if (otp != null) {
            this.log.warn('The provided OTP is incorrect or has expired.');
          }
          if (otpCallback) {
            return otpCallback(otp => this.publish({ otp, otpCallback }));
          }
        }
        throw err;
      });
  }

  afterRelease() {
    const { isReleased } = this.getContext();
    if (isReleased) {
      this.log.log(`🔗 ${this.getPackageUrl()}`);
    }
  }
}

module.exports = npm;
