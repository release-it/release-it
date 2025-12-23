import fs, { close, openSync, statSync, utimesSync, accessSync } from 'node:fs'; // need import fs here due to test stubbing
import util from 'node:util';
import { EOL } from 'node:os';
import gitUrlParse from 'git-url-parse';
import semver from 'semver';
import osName from 'os-name';
import { Eta } from 'eta';
import Log from './log.js';

const debug = util.debug('release-it:shell');

const eta = new Eta({
  autoEscape: false,
  useWith: true,
  tags: ['${', '}'],
  parse: { interpolate: '' },
  rmWhitespace: false,
  autoTrim: false
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const before = (n, func) => {
  var result;
  if (typeof func != 'function') {
    throw new TypeError('Missing argument for `func`');
  }
  n = parseInt(n);
  return function () {
    if (--n > 0) {
      result = func.apply(this, arguments);
    }
    if (n <= 1) {
      func = undefined;
    }
    return result;
  };
};
const tryStatFile = filePath => {
  try {
    return statSync(filePath);
  } catch (e) {
    debug(e);
    return null;
  }
};

/** @internal */
export const execOpts = {
  stdio: process.env.NODE_DEBUG && process.env.NODE_DEBUG.indexOf('release-it') === 0 ? 'pipe' : []
};

export const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));

const pkg = readJSON(new URL('../package.json', import.meta.url));

export const getSystemInfo = () => {
  return {
    'release-it': pkg.version,
    node: process.version,
    os: osName()
  };
};

export const format = (template = '', context = {}) => {
  if (!context || context === null || !template || template === null || template.indexOf('${') === -1) return template;
  const log = new Log();
  try {
    return eta.renderString(template, context);
  } catch (error) {
    log.error(`Unable to render template with context:\n${template}\n${JSON.stringify(context)}`);
    log.error(error);
    throw error;
  }
};

export const truncateLines = (input, maxLines = 10, surplusText = null) => {
  const lines = input.split(EOL);
  const surplus = lines.length - maxLines;
  const output = lines.slice(0, maxLines).join(EOL);
  return surplus > 0 ? (surplusText ? `${output}${surplusText}` : `${output}${EOL}...and ${surplus} more`) : output;
};

export const rejectAfter = (ms, error) =>
  wait(ms).then(() => {
    throw error;
  });

export const parseGitUrl = remoteUrl => {
  if (!remoteUrl) return { host: null, owner: null, project: null, protocol: null, remote: null, repository: null };
  const normalizedUrl = (remoteUrl || '')
    .replace(/^[A-Z]:\\\\/, 'file://') // Assume file protocol for Windows drive letters
    .replace(/^\//, 'file://') // Assume file protocol if only /path is given
    .replace(/\\+/g, '/'); // Replace forward with backslashes
  const parsedUrl = gitUrlParse(normalizedUrl);
  const { resource: host, name: project, protocol, href: remote } = parsedUrl;
  const owner = protocol === 'file' ? parsedUrl.owner.split('/').at(-1) : parsedUrl.owner; // Fix owner for file protocol
  const repository = `${owner}/${project}`;
  return { host, owner, project, protocol, remote, repository };
};

export const reduceUntil = async (collection, fn) => {
  let result;
  for (const item of collection) {
    if (result) break;
    result = await fn(item);
  }
  return result;
};

export const hasAccess = path => {
  try {
    accessSync(path);
    return true;
  } catch (err) {
    return false;
  }
};

export const parseVersion = raw => {
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

export const e = (message, docs, fail = true) => {
  const error = new Error(docs ? `${message}${EOL}Documentation: ${docs}${EOL}` : message);
  error.code = fail ? 1 : 0;
  error.cause = fail ? 'ERROR' : 'INFO';
  return error;
};

/** @internal */
export const touch = (path, callback) => {
  const stat = tryStatFile(path);
  if (stat && stat.isDirectory()) {
    // don't error just exit
    return;
  }

  const fd = openSync(path, 'a');
  close(fd);
  const now = new Date();
  const mtime = now;
  const atime = now;
  utimesSync(path, atime, mtime);
  if (callback) {
    callback();
  }
};

export const fixArgs = args => (args ? (typeof args === 'string' ? args.split(' ') : args) : []);

// Remove npm_config_* variables set by others (e.g. pnpm) that npm warns about
export const getNpmEnv = () => {
  const env = { ...process.env };
  const removeVars = new Set([
    'npm_config_npm_globalconfig',
    'npm_config_verify_deps_before_run',
    'npm_config_overrides',
    'npm_config__jsr_registry'
  ]);
  for (const key of Object.keys(env)) if (removeVars.has(key.toLowerCase())) delete env[key];
  return env;
};

export const upperFirst = string => {
  return string ? string.charAt(0).toUpperCase() + string.slice(1) : '';
};

export const castArray = arr => {
  return Array.isArray(arr) ? arr : [arr];
};

export const once = fn => {
  return before(2, fn);
};

export const pick = (object, keys) => {
  return keys.reduce((obj, key) => {
    if (object && Object.prototype.hasOwnProperty.call(object, key)) {
      obj[key] = object[key];
    }
    return obj;
  }, {});
};

const parsePath = path => {
  const result = [];
  const regex = /[^.[\]]+|\[(?:(\d+)|["'](.+?)["'])\]/g;
  let match;

  while ((match = regex.exec(path)) !== null) {
    result.push(match[1] ?? match[2] ?? match[0]);
  }

  return result;
};

export const get = (obj, path, defaultValue = undefined) => {
  if (!path || typeof path !== 'string') {
    return defaultValue;
  }

  try {
    const keys = parsePath(path);
    return keys.reduce((acc, key) => acc?.[key], obj) ?? defaultValue;
  } catch {
    return defaultValue;
  }
};
