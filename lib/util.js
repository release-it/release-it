import util from 'util';
import semver from 'semver';
import _ from 'lodash';
import { getLatestTag } from './git';

_.templateSettings.interpolate = /\${([\s\S]+?)}/g;

const releaseTypes = ['premajor', 'major', 'preminor', 'minor', 'prepatch', 'patch', 'prerelease', 'pre'];

export function isValidVersion(value) {
  return !!semver.valid(value);
}

export function inc(version, increment = 'patch', identifier) {
  if (!_.includes(releaseTypes, increment)) {
    return increment;
  } else {
    return semver.inc(version, increment, identifier);
  }
}

export function format(template, ...replacements) {
  if (!_.includes(template, '%')) {
    return template;
  } else {
    return util.format(template, ...replacements);
  }
}

export function template(input, context) {
  return _.template(input)(context);
}

export async function parseVersion(options) {
  const { increment, preReleaseId } = options;

  const latestVersion = (await getLatestTag()) || options.npm.version;

  const isValidInc = isValidVersion(increment) && semver.gt(latestVersion, increment);
  const isValidType = _.includes(releaseTypes, increment);

  const version = isValidInc ? increment : isValidType ? inc(latestVersion, increment, preReleaseId) : null;

  if (!version) {
    throw new Error(
      'No or invalid version provided. Please provide --increment argument, or make sure there is a tag to derive it from.'
    );
  }

  return {
    latestVersion,
    version
  };
}

export const isSameRepo = (repoA, repoB) => repoA.repository === repoB.repository && repoA.host === repoB.host;
