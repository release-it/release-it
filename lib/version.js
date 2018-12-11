const semver = require('semver');
const { getLatestTag } = require('./git');
const _ = require('lodash');
const { getRecommendedType, getIsLateChangeLog } = require('./recommendations');
const { warn } = require('./log');

const releaseTypes = ['patch', 'minor', 'major'];
const preReleaseTypes = ['prepatch', 'preminor', 'premajor'];
const continuationTypes = ['prerelease', 'pre'];
const allReleaseTypes = [...releaseTypes, ...preReleaseTypes, ...continuationTypes];

const isPreRelease = value => !!semver.prerelease(value);

const isValid = value => !!semver.valid(value);

const parse = async options => {
  const { increment, preRelease, preReleaseId } = options;
  const npmVersion = _.get(options, 'npm.version');

  const latestTag = await getLatestTag();
  const latestVersion = (isValid(latestTag) ? latestTag : npmVersion) || '0.0.0';

  if (latestTag && npmVersion) {
    if (!isValid(latestTag)) {
      warn(`Latest Git tag (${latestTag}) is not a valid semver version.`);
    } else if (!isValid(npmVersion)) {
      warn(`The npm version (${npmVersion}) is not a valid semver version.`);
    } else if (semver.neq(latestTag, npmVersion)) {
      warn(`Latest Git tag (${latestTag}) doesn't match package.json#version (${npmVersion}).`);
    }
  }

  if (!latestTag && !npmVersion) {
    warn(`Could not find latest Git tag or package.json#version. Using "0.0.0" as latest version.`);
  }

  const releaseType = (await getRecommendedType(increment)) || increment;
  const isPreRelease = preRelease || (releaseType || '').startsWith('pre');
  const normalizedType = _.includes(releaseTypes, releaseType) && isPreRelease ? `pre${releaseType}` : releaseType;
  const isValidIncrement = isValid(increment) && semver.gt(increment, latestVersion);
  const isPreReleaseContinuation = isPreRelease && !!semver.prerelease(latestVersion);
  const isValidType = _.includes(allReleaseTypes, normalizedType);
  const isLateChangeLog = getIsLateChangeLog(increment);

  const result = {
    latestVersion,
    version: null
  };

  switch (true) {
    case isValidIncrement:
      result.version = increment;
      break;
    case isPreReleaseContinuation:
      result.version = semver.inc(latestVersion, 'prerelease', preReleaseId);
      break;
    case isValidType:
      result.version = semver.inc(latestVersion, normalizedType, preReleaseId);
      break;
    default:
      const coercedVersion = !isValid(increment) && semver.coerce(increment);
      if (coercedVersion) {
        result.version = coercedVersion.toString();
        warn(`Coerced invalid semver version "${increment}" into "${result.version}".`);
      }
      break;
  }

  if (isLateChangeLog) {
    result.isLateChangeLog = isLateChangeLog;
  }

  return result;
};

module.exports = {
  releaseTypes,
  preReleaseTypes,
  continuationTypes,
  isValid,
  isPreRelease,
  parse
};
