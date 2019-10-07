const fs = require('fs');
const { EOL } = require('os');
const _ = require('lodash');
const gitUrlParse = require('git-url-parse');
const semver = require('semver');
const { TimeoutError } = require('./errors');

const format = (template = "", context = {}) => {
  try {
    template = template.startsWith("git log")
      ? template.replace("[REV_RANGE]", "${latestTag}...HEAD")
      : template.replace(/%s/g, "${version}");
    return _.template(template)(context);
  } catch (e) {
    console.error("Could not render template '" + template + "'", e);
    throw e;
  }
};

const truncateLines = (input, maxLines = 10, surplusText = null) => {
  const lines = input.split(EOL);
  const surplus = lines.length - maxLines;
  const output = lines.slice(0, maxLines).join(EOL);
  return surplus > 0 ? (surplusText ? `${output}${surplusText}` : `${output}${EOL}...and ${surplus} more`) : output;
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const rejectAfter = ms =>
  wait(ms).then(() => {
    throw new TimeoutError(`Timed out after ${ms}ms.`);
  });

const parseGitUrl = remoteUrl => {
  const normalizedUrl = remoteUrl.replace(/\\/g, '/');
  const parsedUrl = gitUrlParse(normalizedUrl);
  const { resource: host, name: project, protocol, href: remote } = parsedUrl;
  const owner = protocol === 'file' ? _.last(parsedUrl.owner.split('/')) : parsedUrl.owner;
  const repository = `${owner}/${project}`;
  return { host, owner, project, protocol, remote, repository };
};

const reduceUntil = async (collection, fn) => {
  let result;
  for (const item of collection) {
    if (result) break;
    result = await fn(item);
  }
  return result;
};

const hasAccess = path => {
  try {
    fs.accessSync(path);
    return true;
  } catch (err) {
    return false;
  }
};

const parseVersion = raw => {
  if (!raw) return { version: null, isPreRelease: false, preReleaseId: null };
  const version = semver.valid(raw) ? raw : semver.coerce(raw);
  const parsed = new semver(version);
  const isPreRelease = parsed.prerelease.length > 0;
  const preReleaseId = isPreRelease && isNaN(parsed.prerelease[0]) ? parsed.prerelease[0] : null;
  return {
    version,
    isPreRelease,
    preReleaseId
  };
};

module.exports = {
  format,
  truncateLines,
  rejectAfter,
  reduceUntil,
  parseGitUrl,
  hasAccess,
  parseVersion
};
