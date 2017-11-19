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

  const isValidInc = isValid(increment) && semver.gt(increment, latestVersion);
  const isValidType = _.includes(releaseTypes, increment);

  const version = isValidInc ? increment : isValidType ? inc(latestVersion, increment, preReleaseId) : false;

  return {
    latestVersion,
    version
  };
};

module.exports = {
  isValid,
  parse
};
