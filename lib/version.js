const semver = require('semver');
const { getLatestTag } = require('./git');
const { inc } = require('bump-file');
const _ = require('lodash');

const releaseTypes = ['premajor', 'major', 'preminor', 'minor', 'prepatch', 'patch', 'prerelease', 'pre'];

const isValid = value => !!semver.valid(value);

const parse = async options => {
  const { increment, preReleaseId } = options;

  const latestTag = await getLatestTag();
  const latestVersion = isValid(latestTag) ? latestTag : options.npm.version;

  const isValidVersion = isValid(increment) && semver.gt(increment, latestVersion);

  if (isValidVersion) {
    return {
      latestVersion,
      version: increment
    };
  }

  const isValidType = _.includes(releaseTypes, increment);

  if (isValidType) {
    return {
      latestVersion,
      version: inc(latestVersion, increment, preReleaseId)
    };
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
