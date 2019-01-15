const semver = require('semver');
const _ = require('lodash');
const Recommendations = require('./recommendations');
const Log = require('./log');
const { InvalidVersionError } = require('./errors');
const debug = require('debug')('release-it:version');

const DEFAULT_USE = 'git.tag';
const USE_PKG_VERSION = 'pkg.version';

const releaseTypes = ['patch', 'minor', 'major'];
const preReleaseTypes = ['prepatch', 'preminor', 'premajor'];
const continuationTypes = ['prerelease', 'pre'];
const allReleaseTypes = [...releaseTypes, ...preReleaseTypes, ...continuationTypes];

class Version {
  constructor(...args) {
    const options = Object.assign({}, ...args);
    this.details = {
      preReleaseId: options.preReleaseId
    };
    this.log = options.log || new Log(options);
    this.recs = options.recommendations || new Recommendations();
  }

  validate() {
    if (!this.version) {
      throw new InvalidVersionError();
    }
  }

  setLatestVersion({ use = DEFAULT_USE, gitTag, pkgVersion, isRootDir = true }) {
    const isTagValid = this.isValid(gitTag);
    const isPkgValid = this.isValid(pkgVersion);
    if (use === USE_PKG_VERSION || !isRootDir) {
      if (isPkgValid) {
        return (this.details.latestVersion = pkgVersion);
      } else {
        this.log.warn(`The version in package.json (${pkgVersion}) is not a valid semver version.`);
      }
    }
    if (use === DEFAULT_USE && isRootDir && isTagValid && isPkgValid && semver.neq(gitTag, pkgVersion)) {
      this.log.warn(`Latest Git tag (${gitTag}) does not match package.json#version (${pkgVersion}).`);
    }
    if (isTagValid) {
      return (this.details.latestVersion = gitTag.replace(/^v/, ''));
    } else {
      this.log.warn(`Latest Git tag (${gitTag}) is not a valid semver version.`);
      if (isPkgValid) {
        return (this.details.latestVersion = pkgVersion);
      }
    }
    this.log.warn('Could not find valid latest Git tag or version in package.json. Using "0.0.0" as latest version.');
    this.details.latestVersion = '0.0.0';
  }

  isPreRelease(version) {
    return Boolean(semver.prerelease(version));
  }

  isValid(version) {
    return Boolean(semver.valid(version));
  }

  isRecommendation(increment) {
    return this.recs.isRecommendation(increment);
  }

  getRecommendedType(increment) {
    return this.recs.getRecommendedType(increment);
  }

  get latestVersion() {
    return this.details.latestVersion;
  }

  get version() {
    return this.details.version;
  }

  set version(version) {
    const { latestVersion } = this.details;
    const isPreRelease = this.isPreRelease(version);
    const preReleaseId = _.get(semver.prerelease(version), 0, null);
    const latestIsPreRelease = this.isPreRelease(latestVersion);
    this.details = {
      version,
      isPreRelease,
      preReleaseId,
      latestVersion,
      latestIsPreRelease,
      isPreReleaseContinuation: isPreRelease && latestIsPreRelease
    };
    debug(this.details);
  }

  async bump({ increment, preRelease }) {
    const { latestVersion, preReleaseId } = this.details;
    const isValidIncrement = this.isValid(increment) && semver.gte(increment, latestVersion);
    const type = this.isRecommendation(increment) ? await this.getRecommendedType(increment) : increment;
    const isPreRelease = preRelease || (increment || '').startsWith('pre');
    const normalizedType = _.includes(releaseTypes, type) && isPreRelease ? `pre${type}` : type;
    const isPreReleaseContinuation = isPreRelease && this.isPreRelease(latestVersion);
    const isValidType = _.includes(allReleaseTypes, normalizedType);

    switch (true) {
      case isValidIncrement:
        this.version = increment;
        break;
      case isPreReleaseContinuation:
        this.version = semver.inc(latestVersion, 'prerelease', preReleaseId);
        break;
      case isValidType:
        this.version = semver.inc(latestVersion, normalizedType, preReleaseId);
        break;
      default: {
        const coercedVersion = !this.isValid(increment) && semver.coerce(increment);
        if (coercedVersion) {
          this.version = coercedVersion.toString();
          this.log.warn(`Coerced invalid semver version "${increment}" into "${this.version}".`);
        } else {
          this.details.latestIsPreRelease = this.isPreRelease(latestVersion);
        }
        break;
      }
    }
  }
}

module.exports = Version;
module.exports.releaseTypes = releaseTypes;
module.exports.preReleaseTypes = preReleaseTypes;
module.exports.continuationTypes = continuationTypes;
