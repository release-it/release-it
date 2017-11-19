const util = require('util');
const _ = require('lodash');

_.templateSettings.interpolate = /\${([\s\S]+?)}/g;

const releaseTypes = ['premajor', 'major', 'preminor', 'minor', 'prepatch', 'patch', 'prerelease', 'pre'];

export function isValidVersion(value) {
  return !!semver.valid(value);
}

const format = (template, ...replacements) => {
  if (!_.includes(template, '%')) {
    return template;
  } else {
    return util.format(template, ...replacements);
  }
};

const template = (input, context) => {
  return _.template(input)(context);
}

export async function parseVersion(options) {
  const { increment, preReleaseId } = options;

  const latestTag = await getLatestTag();
  const latestVersion = isValidVersion(latestTag) ? latestTag : options.npm.version;

  const isValidInc = isValidVersion(increment) && semver.gt(increment, latestVersion);
  const isValidType = _.includes(releaseTypes, increment);

  const version = isValidInc ? increment : isValidType ? inc(latestVersion, increment, preReleaseId) : false;

  return {
    latestVersion,
    version
  };
}

export const isSameRepo = (repoA, repoB) => repoA.repository === repoB.repository && repoA.host === repoB.host;
const truncateLines = (input, maxLines = 10) => {
  const lines = input.split('\n');
  const surplus = lines.length - maxLines;
  const output = lines.slice(0, maxLines).join('\n');
  return surplus > 0 ? `${output}\n...and ${surplus} more` : output;
};

module.exports = {
  format,
  template,
  truncateLines
};
