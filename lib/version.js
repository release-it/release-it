const semver = require('semver');
const { getLatestTag } = require('./git');
const _ = require('lodash');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const { warn } = require('./log');

const releaseTypes = ['patch', 'minor', 'major'];
const preReleaseTypes = ['prepatch', 'preminor', 'premajor'];
const continuationTypes = ['prerelease', 'pre'];
const allReleaseTypes = [...releaseTypes, ...preReleaseTypes, ...continuationTypes];

const isValid = value => !!semver.valid(value);

const isPreRelease = value => !!semver.prerelease(value);

const isValidSystem = ({ system }) => system === 'conventional';

const getConventionalRecommendedBump = preset =>
  new Promise((resolve, reject) => {
    conventionalRecommendedBump(
      {
        preset
      },
      function(err, result) {
        if (err) return reject(err);
        resolve(result.releaseType);
      }
    );
  });

const parse = async options => {
  const { increment, preReleaseId } = options;
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

  if (!increment) {
    const isContinuation = semver.prerelease(latestVersion) && preReleaseId;
    const version = isContinuation ? semver.inc(latestVersion, 'prerelease', preReleaseId) : null;
    return {
      latestVersion,
      version
    };
  }

  const isValidVersion = isValid(increment) && semver.gt(increment, latestVersion);

  if (isValidVersion) {
    return {
      latestVersion,
      version: increment
    };
  }

  const isValidType = _.includes(allReleaseTypes, increment);

  if (isValidType) {
    const inc = _.includes(releaseTypes, increment) && preReleaseId ? `pre${increment}` : increment;
    return {
      latestVersion,
      version: semver.inc(latestVersion, inc, preReleaseId)
    };
  }

  const [system, preset] = increment.split(':');

  if (isValidSystem({ system, preset })) {
    if (system === 'conventional') {
      const recommendedType = await getConventionalRecommendedBump(preset);
      const isValidRecommendedType = _.includes(releaseTypes, recommendedType);
      if (isValidRecommendedType) {
        const isContinuation = semver.prerelease(latestVersion) && preReleaseId;
        const increment = isContinuation
          ? 'prerelease'
          : preReleaseId
          ? getFullIncrement(recommendedType)
          : recommendedType;
        return {
          latestVersion,
          version: semver.inc(latestVersion, increment, preReleaseId),
          isLateChangeLog: true
        };
      }
    }
  }

  if (!isValid(increment)) {
    const coercedVersion = semver.coerce(increment);
    if (coercedVersion) {
      const version = coercedVersion.toString();
      warn(`Coerced invalid semver version "${increment}" into "${version}".`);
      return {
        latestVersion,
        version
      };
    }
  }

  return {
    latestVersion,
    version: null
  };
};

module.exports = {
  releaseTypes,
  preReleaseTypes,
  continuationTypes,
  isValid,
  isPreRelease,
  parse
};
