const semver = require('semver');
const _ = require('lodash');
const urlJoin = require('url-join');
const { rejectAfter } = require('./util');
const debug = require('debug')('release-it:npm');
const { npmTimeoutError, npmAuthError } = require('./errors');

const REGISTRY_TIMEOUT = 10000;
const DEFAULT_TAG = 'latest';
const NPM_BASE_URL = 'https://www.npmjs.com';
const NPM_DEFAULT_REGISTRY = 'https://registry.npmjs.org';

const noop = Promise.resolve();

class npm {
  constructor(...args) {
    const options = Object.assign({}, ...args);
    this.options = options;
    this.log = options.log;
    this.shell = options.shell;
  }

  async validate() {
    const { publish, version } = this.options;

    if (!publish) return;

    const validations = Promise.all([this.isRegistryUp(), this.isAuthenticated(), this.getLatestVersion()]);

    await Promise.race([validations, rejectAfter(REGISTRY_TIMEOUT)]).catch(() => {
      throw new npmTimeoutError(REGISTRY_TIMEOUT);
    });

    const [isRegistryUp, isAuthenticated, latestVersion] = await validations;

    if (!isRegistryUp) {
      throw new npmTimeoutError(REGISTRY_TIMEOUT);
    }
    if (!isAuthenticated) {
      throw new npmAuthError();
    }
    if (!latestVersion) {
      this.log.warn('No version found in npm registry. Assuming new package.');
    } else {
      if (!semver.eq(latestVersion, version)) {
        this.log.warn(`Latest version in registry (${latestVersion}) does not match package.json (${version}).`);
      }
    }
  }

  get version() {
    return this.options.version;
  }

  isRegistryUp() {
    const registry = this.getRegistry();
    const registryArg = registry !== NPM_DEFAULT_REGISTRY ? ` --registry ${registry}` : '';
    return this.shell.run(`npm ping${registryArg}`).then(
      () => true,
      err => {
        debug(err);
        if (/code E40[04]/.test(err)) {
          this.log.warn('Ignoring unsupported `npm ping` command response.');
          return true;
        }
        return false;
      }
    );
  }

  isAuthenticated() {
    const registry = this.getRegistry();
    const registryArg = registry !== NPM_DEFAULT_REGISTRY ? ` --registry ${registry}` : '';
    return this.shell.run(`npm whoami${registryArg}`).then(
      () => true,
      err => {
        debug(err);
        if (/code E40[04]/.test(err)) {
          this.log.warn('Ignoring unsupported `npm whoami` command response.');
          return true;
        }
        return false;
      }
    );
  }

  getLatestVersion() {
    const tag = this.getTag(this.options);
    return this.shell.run(`npm show ${this.options.name}@${tag} version`).catch(() => null);
  }

  getRegistry() {
    return _.get(this.options, 'publishConfig.registry', NPM_DEFAULT_REGISTRY);
  }

  getPackageUrl() {
    const registry = this.getRegistry();
    const baseUrl = registry !== NPM_DEFAULT_REGISTRY ? registry : NPM_BASE_URL;
    return urlJoin(baseUrl, 'package', this.options.name);
  }

  getTag({ tag = DEFAULT_TAG, version, isPreRelease } = {}) {
    if (!isPreRelease || !version || tag !== DEFAULT_TAG) {
      return tag;
    } else {
      const preReleaseComponents = semver.prerelease(version);
      return _.get(preReleaseComponents, 0, tag);
    }
  }

  publish({ tag = this.options.tag, version, isPreRelease, otp = this.options.otp, otpCallback } = {}) {
    const { name, publishPath = '.', access, private: isPrivate } = this.options;
    const resolvedTag = this.getTag({ tag, version, isPreRelease });
    const isScopedPkg = name.startsWith('@');
    const accessArg = isScopedPkg && access ? `--access ${access}` : '';
    const otpArg = otp ? `--otp ${otp}` : '';
    const dryRunArg = this.options.isDryRun ? '--dry-run' : '';
    if (isPrivate) {
      this.log.warn('Skip publish: package is private.');
      return noop;
    }
    return this.shell
      .run(`npm publish ${publishPath} --tag ${resolvedTag} ${accessArg} ${otpArg} ${dryRunArg}`.trim())
      .then(() => {
        this.isPublished = true;
      })
      .catch(err => {
        debug(err);
        if (/one-time pass/.test(err)) {
          if (otp != null) {
            this.log.warn('The provided OTP is incorrect or has expired.');
          }
          if (otpCallback) {
            return otpCallback(otp => this.publish({ tag, version, isPreRelease, otp, otpCallback }));
          }
        }
        throw err;
      });
  }
}

module.exports = npm;
