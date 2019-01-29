const semver = require('semver');
const _ = require('lodash');
const { rejectAfter } = require('./util');
const debug = require('debug')('release-it:npm');
const { npmTimeoutError, npmAuthError } = require('./errors');

const REGISTRY_TIMEOUT = 10000;
const DEFAULT_TAG = 'latest';
const NPM_BASE_URL = 'https://www.npmjs.com/package/';

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
    return this.shell.run('npm ping').then(() => true, () => false);
  }

  isAuthenticated() {
    return this.shell.run('npm whoami').then(() => true, () => false);
  }

  getLatestVersion() {
    const tag = this.getTag(this.options);
    return this.shell.run(`npm show ${this.options.name}@${tag} version`).catch(() => null);
  }

  getPackageUrl() {
    return `${NPM_BASE_URL}${this.options.name}`;
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
      .run(`npm publish ${publishPath} --tag ${resolvedTag} ${accessArg} ${otpArg} ${dryRunArg}`)
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
