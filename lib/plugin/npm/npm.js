const path = require('path');
const semver = require('semver');
const urlJoin = require('url-join');
const Plugin = require('..');
const prompts = require('./prompts');
const { hasAccess, rejectAfter, parseVersion } = require('../../util');
const { npmTimeoutError, npmAuthError } = require('../../errors');

const r = { write: false };

const MANIFEST_PATH = './package.json';
const REGISTRY_TIMEOUT = 10000;
const DEFAULT_TAG = 'latest';
const DEFAULT_TAG_PRERELEASE = 'next';
const NPM_BASE_URL = 'https://www.npmjs.com';
const NPM_DEFAULT_REGISTRY = 'https://registry.npmjs.org';

const noop = Promise.resolve();

class npm extends Plugin {
  static isEnabled() {
    return hasAccess(MANIFEST_PATH);
  }

  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
  }

  async init() {
    const { name, version: latestVersion, private: isPrivate, publishConfig } = require(path.resolve(MANIFEST_PATH));
    this.setContext({ name, latestVersion, private: isPrivate, publishConfig });

    const validations = Promise.all([this.isRegistryUp(), this.isAuthenticated(), this.getLatestRegistryVersion()]);

    await Promise.race([validations, rejectAfter(REGISTRY_TIMEOUT)]);

    const [isRegistryUp, isAuthenticated, latestVersionInRegistry] = await validations;

    if (!isRegistryUp) {
      throw new npmTimeoutError(REGISTRY_TIMEOUT);
    }
    if (!isAuthenticated) {
      throw new npmAuthError();
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
    return this.getContext('latestVersion');
  }

  bump(version) {
    const task = () =>
      this.exec(`npm version ${version} --no-git-tag-version`).catch(err => {
        if (/Version not changed/.test(err)) {
          this.log.warn(`Did not update version in package.json etc. (already at ${version}).`);
        }
      });
    this.setContext({ version });
    return this.spinner.show({ task, label: 'npm version' });
  }

  async release() {
    if (this.options.publish === false) return;
    const publish = () => this.publish({ otpCallback });
    const otpCallback = this.global.isInteractive ? task => this.step({ prompt: 'otp', task }) : null;
    await this.step({ task: publish, label: 'npm publish', prompt: 'publish' });
  }

  isRegistryUp() {
    const registry = this.getRegistry();
    const registryArg = registry !== NPM_DEFAULT_REGISTRY ? ` --registry ${registry}` : '';
    return this.exec(`npm ping${registryArg}`).then(
      () => true,
      err => {
        this.debug(err);
        return /code E404/.test(err);
      }
    );
  }

  isAuthenticated() {
    const registry = this.getRegistry();
    const registryArg = registry !== NPM_DEFAULT_REGISTRY ? ` --registry ${registry}` : '';
    return this.exec(`npm whoami${registryArg}`).then(
      () => true,
      err => {
        this.debug(err);
        return /code E404/.test(err);
      }
    );
  }

  async getLatestRegistryVersion() {
    const name = this.getName();
    const tag = await this.resolveTag();
    return this.exec(`npm show ${name}@${tag} version`, r).catch(() => null);
  }

  getRegistryPreReleaseTags() {
    return this.exec(`npm view ${this.getName()} dist-tags --json`, r).then(output => {
      try {
        const tags = JSON.parse(output);
        return Object.keys(tags).filter(tag => tag !== DEFAULT_TAG);
      } catch (err) {
        this.log.warn('Unable to get pre-release tag(s) from npm registry.');
        this.debug(err);
      }
    });
  }

  getReleaseUrl() {
    const registry = this.getRegistry();
    const baseUrl = registry !== NPM_DEFAULT_REGISTRY ? registry : NPM_BASE_URL;
    return urlJoin(baseUrl, 'package', this.getName());
  }

  getRegistry() {
    return this.getContext('publishConfig.registry') || NPM_DEFAULT_REGISTRY;
  }

  async guessPreReleaseTag() {
    const tags = await this.getRegistryPreReleaseTags();
    return tags[0] || DEFAULT_TAG_PRERELEASE;
  }

  async resolveTag() {
    const version = this.getContext('version') || this.getLatestVersion();
    const { isPreRelease, preReleaseId } = parseVersion(version);
    return !isPreRelease ? DEFAULT_TAG : preReleaseId || (await this.guessPreReleaseTag());
  }

  async publish({ otp = this.options.otp, otpCallback } = {}) {
    const { publishPath = '.', access } = this.options;
    const { name, private: isPrivate } = this.getContext();
    const tag = this.options.tag || (await this.resolveTag());
    const isScopedPkg = name.startsWith('@');
    const accessArg = isScopedPkg && access ? `--access ${access}` : '';
    const otpArg = otp ? `--otp ${otp}` : '';
    const dryRunArg = this.global.isDryRun ? '--dry-run' : '';
    if (isPrivate) {
      this.log.warn('Skip publish: package is private.');
      return noop;
    }
    return this.exec(`npm publish ${publishPath} --tag ${tag} ${accessArg} ${otpArg} ${dryRunArg}`, r)
      .then(() => {
        this.isReleased = true;
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
}

module.exports = npm;
