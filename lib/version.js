const semver = require('semver');
const { getLatestTag } = require('./git');
const { inc } = require('bump-file');
const _ = require('lodash');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const { warn } = require('./log');

const shortcutIncrements = ['major', 'minor', 'patch'];
const releaseTypes = ['premajor', 'major', 'preminor', 'minor', 'prepatch', 'patch', 'prerelease', 'pre'];

const getPreIncrement = increment => (_.includes(shortcutIncrements, increment) ? `pre${increment}` : 'prerelease')

const isValid = value => !!semver.valid(value);

const isValidSystem = ({ system }) => system === 'conventional';

const getConventionalRecommendedBump = preset =>
  new Promise((resolve, reject) => {
    conventionalRecommendedBump(
      {
        preset
      },
      function (err, result) {
        if (err) return reject(err);
        resolve(result.releaseType);
      }
    );
  });

const parse = async options => {
  let { increment } = options;
  const { preReleaseId, preRelease } = options;
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
    return {
      latestVersion,
      version: latestVersion
    };
  }

  const isValidVersion = isValid(increment) && semver.gt(increment, latestVersion);

  if (isValidVersion) {
    if (preRelease) { increment = getPreIncrement(increment); }
    return {
      latestVersion,
      version: increment
    };
  }

  const isValidType = _.includes(releaseTypes, increment);

  if (isValidType) {
    if (preRelease) { increment = getPreIncrement(increment); }
    return {
      latestVersion,
      version: inc(latestVersion, increment, preReleaseId)
    };
  }

  const [system, preset] = increment.split(':');

  if (isValidSystem({ system, preset })) {
    if (system === 'conventional') {
      const recommendedType = await getConventionalRecommendedBump(preset);
      const isValidRecommendedType = _.includes(releaseTypes, recommendedType);
      if (isValidRecommendedType) {
        const isContinuation = semver.prerelease(latestVersion) && preRelease;
        const increment = isContinuation
          ? 'prerelease'
          : preRelease
            ? getPreIncrement(recommendedType)
            : recommendedType;
        return {
          latestVersion,
          version: inc(latestVersion, increment, preReleaseId)
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
  isValid,
  parse
};
