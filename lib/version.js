const semver = require('semver');
const _ = require('lodash');
const Recommendations = require('./recommendations');
const Log = require('./log');
const { InvalidVersionError } = require('./errors');

const releaseTypes = ['patch', 'minor', 'major'];
const preReleaseTypes = ['prepatch', 'preminor', 'premajor'];
const continuationTypes = ['prerelease', 'pre'];
const allReleaseTypes = [...releaseTypes, ...preReleaseTypes, ...continuationTypes];

class Version {
  constructor({ latestVersion, preReleaseId, log, recommendations } = {}) {
    this.details = {
      preReleaseId,
      latestVersion
    };
    this.log = log || new Log();
    this.recs = recommendations || new Recommendations();
  }

  isPreRelease(version) {
    return Boolean(semver.prerelease(version));
  }

  isValid(version) {
    return Boolean(semver.valid(version));
  }

  coerce(value) {
    return semver.coerce(value);
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
  }

  validate() {
    if (!this.version) {
      throw new InvalidVersionError();
    }
  }

  async bump({ increment, preRelease }) {
    const { latestVersion, preReleaseId } = this.details;
    const isValidIncrement = this.isValid(increment) && semver.gt(increment, latestVersion);
    const type = this.recs.isRecommendation(increment) ? await this.recs.getRecommendedType(increment) : increment;
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
        }
        break;
      }
    }
  }

  showWarnings({ latestGitTag, npmVersion, useTag }) {
    if (npmVersion && !this.isValid(npmVersion)) {
      this.log.warn(`The npm version (${npmVersion}) is not a valid semver version.`);
    }
    if (latestGitTag && !this.isValid(latestGitTag)) {
      this.log.warn(`Latest Git tag (${latestGitTag}) is not a valid semver version.`);
    }
    if (useTag && this.isValid(latestGitTag) && this.isValid(npmVersion) && semver.neq(latestGitTag, npmVersion)) {
      this.log.warn(`Latest Git tag (${latestGitTag}) doesn't match package.json#version (${npmVersion}).`);
    }
    if (!latestGitTag && !npmVersion) {
      this.log.warn(`Could not find latest Git tag or package.json#version. Using "0.0.0" as latest version.`);
    }
  }
}

module.exports = Version;
module.exports.releaseTypes = releaseTypes;
module.exports.preReleaseTypes = preReleaseTypes;
module.exports.continuationTypes = continuationTypes;
