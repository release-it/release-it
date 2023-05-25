import fs from 'node:fs';
import { EOL } from 'node:os';
import _ from 'lodash';
import gitUrlParse from 'git-url-parse';
import semver from 'semver';
import osName from 'os-name';
import Log from './log.js';

const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));

const pkg = readJSON(new URL('../package.json', import.meta.url));

const log = new Log();

const getSystemInfo = () => {
  return {
    'release-it': pkg.version,
    node: process.version,
    os: osName()
  };
};

const format = (template = '', context = {}) => {
  try {
    return _.template(template)(context);
  } catch (error) {
    log.error(`Unable to render template with context:\n${template}\n${JSON.stringify(context)}`);
    log.error(error);
    throw error;
  }
};

const truncateLines = (input, maxLines = 10, surplusText = null) => {
  const lines = input.split(EOL);
  const surplus = lines.length - maxLines;
  const output = lines.slice(0, maxLines).join(EOL);
  return surplus > 0 ? (surplusText ? `${output}${surplusText}` : `${output}${EOL}...and ${surplus} more`) : output;
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const rejectAfter = (ms, error) =>
  wait(ms).then(() => {
    throw error;
  });

const parseGitUrl = remoteUrl => {
  if (!remoteUrl) return { host: null, owner: null, project: null, protocol: null, remote: null, repository: null };
  const normalizedUrl = (remoteUrl || '')
    .replace(/^[A-Z]:\\\\/, 'file://') // Assume file protocol for Windows drive letters
    .replace(/^\//, 'file://') // Assume file protocol if only /path is given
    .replace(/\\+/g, '/'); // Replace forward with backslashes
  const parsedUrl = gitUrlParse(normalizedUrl);
  const { resource: host, name: project, protocol, href: remote } = parsedUrl;
  const owner = protocol === 'file' ? _.last(parsedUrl.owner.split('/')) : parsedUrl.owner; // Fix owner for file protocol
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
  if (raw == null) return { version: raw, isPreRelease: false, preReleaseId: null };
  const version = semver.valid(raw) ? raw : semver.coerce(raw);
  if (!version) return { version: raw, isPreRelease: false, preReleaseId: null };
  const parsed = semver.parse(version);
  const isPreRelease = parsed.prerelease.length > 0;
  const preReleaseId = isPreRelease && isNaN(parsed.prerelease[0]) ? parsed.prerelease[0] : null;
  return {
    version: version.toString(),
    isPreRelease,
    preReleaseId
  };
};


/**
 * Deeply merges multiple objects into a target object, supporting deep nesting.
 * Existing values in the target object are preserved when `undefined` or `null` values are encountered.
 * The custom function is a simpler implementation that focuses on deep merging objects while preserving values
 * But it may not handle arrays or other edge cases as extensively as Lodash's merge() function
 *
 * @param {object} target - The target object to merge into.
 * @param {...object} sources - The source objects to merge into the target object.
 * @returns {object} - The merged object.
 * @throws {TypeError} - If the target is not an object or is null.
 */
const deepMerge = (target, ...sources) => {
  // Check that the target is an object and not null
  if (typeof target !== 'object' || target === null) {
    throw new TypeError('Target must be an object');
  }
  let sourceValue, targetValue;
  // Loop through the sources
  for (const source of sources) {
    // Skip if source is not an object or is null
    if (typeof source !== 'object' || source === null) {
      continue;
    }
    // Loop through each key in the source
    for (const key in source) {
      // Only check keys that are owned by the source object
      if (source.hasOwnProperty(key)) {
        sourceValue = source[key];
        targetValue = target[key];
        // If the source value is an object, do a deep merge
        if (typeof sourceValue === 'object' && sourceValue !== null) {
          if (typeof targetValue === 'object' && targetValue !== null) {
            target[key] = deepMerge(Object.assign({}, targetValue), sourceValue);
          } else {
            target[key] = deepMerge({}, sourceValue);
          }
        } else if (sourceValue !== undefined && sourceValue !== null) {
          // Otherwise just assign the source value to the target
          target[key] = sourceValue;
        }
      }
    }
  }
  return target;
};

const e = (message, docs, fail = true) => {
  const error = new Error(docs ? `${message}${EOL}Documentation: ${docs}${EOL}` : message);
  error.code = fail ? 1 : 0;
  return error;
};

export {
  getSystemInfo,
  format,
  truncateLines,
  rejectAfter,
  reduceUntil,
  parseGitUrl,
  hasAccess,
  parseVersion,
  readJSON,
  deepMerge,
  e
};
