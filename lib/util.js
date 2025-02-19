import fs, { close, openSync, statSync, utimesSync, accessSync } from 'node:fs'; // need import fs here due to test stubbing
import util from 'node:util';
import { EOL } from 'node:os';
import gitUrlParse from 'git-url-parse';
import semver from 'semver';
import osName from 'os-name';
import Log from './log.js';

export const execOpts = {
  stdio: process.env.NODE_DEBUG && process.env.NODE_DEBUG.indexOf('release-it') === 0 ? 'pipe' : []
};

const debug = util.debug('release-it:shell');

const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));

const pkg = readJSON(new URL('../package.json', import.meta.url));

const getSystemInfo = () => {
  return {
    'release-it': pkg.version,
    node: process.version,
    os: osName()
  };
};

const templateInterpolate = (str, data) => {
  if (typeof str !== 'string' || !str) {
    return ''; // Return an empty string if input is not a valid string
  }

  return str.replace(/\$\{([\s\S]+?)\}/g, (_, path) => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], data);
    if (value === undefined) {
      throw new ReferenceError(`${path} is not defined`);
    }
    return value !== undefined ? value : ''; // Return empty string if key is not found
  });
};

const format = (template = '', context = {}) => {
  try {
    return templateInterpolate(template, context);
  } catch (error) {
    const log = new Log();
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
  const owner = protocol === 'file' ? parsedUrl.owner.split('/').slice(-1)[0] : parsedUrl.owner; // Fix owner for file protocol
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
    accessSync(path);
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

const e = (message, docs, fail = true) => {
  const error = new Error(docs ? `${message}${EOL}Documentation: ${docs}${EOL}` : message);
  error.code = fail ? 1 : 0;
  error.cause = fail ? 'ERROR' : 'INFO';
  return error;
};

const touch = (path, callback) => {
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

const tryStatFile = filePath => {
  try {
    return statSync(filePath);
  } catch (e) {
    debug(e);
    return null;
  }
};

const fixArgs = args => (args ? (typeof args === 'string' ? args.split(' ') : args) : []);

const isPlainObject = value => {
  if (typeof value !== 'object' || value === null) return false;

  if (Object.prototype.toString.call(value) !== '[object Object]') return false;

  const proto = Object.getPrototypeOf(value);
  if (proto === null) return true;

  const Ctor = Object.prototype.hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return (
    typeof Ctor === 'function' &&
    Ctor instanceof Ctor &&
    Function.prototype.call(Ctor) === Function.prototype.call(value)
  );
};

const get = (obj, propsArg, defaultValue) => {
  if (!obj) {
    return defaultValue;
  }
  var props, prop;
  if (Array.isArray(propsArg)) {
    props = propsArg.slice(0);
  }
  if (typeof propsArg == 'string') {
    props = propsArg.split('.');
  }
  if (typeof propsArg == 'symbol') {
    props = [propsArg];
  }
  if (!Array.isArray(props)) {
    if (typeof defaultValue !== 'undefined') return defaultValue;
    throw new Error('props arg must be an array, a string or a symbol');
  }
  while (props.length) {
    prop = props.shift();
    if (!obj) {
      return defaultValue;
    }
    obj = obj[prop];
    if (obj === undefined) {
      return defaultValue;
    }
  }
  return obj;
};

const isObject = value => {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
};

const upperFirst = string => {
  return string ? string.charAt(0).toUpperCase() + string.slice(1) : '';
};

const castArray = arr => {
  return Array.isArray(arr) ? arr : [arr];
};

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

const once = fn => {
  return before(2, fn);
};

const pick = (object, keys) => {
  return keys.reduce((obj, key) => {
    if (object && Object.prototype.hasOwnProperty.call(object, key)) {
      obj[key] = object[key];
    }
    return obj;
  }, {});
};

const merge = (target, ...sources) => {
  if (!target || typeof target !== 'object') {
    return target;
  }

  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue;
    }

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
          // Merge arrays by concatenating
          target[key] = [...targetValue, ...sourceValue];
        } else if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
          // Recursively merge objects
          target[key] = merge(targetValue && typeof targetValue === 'object' ? targetValue : {}, sourceValue);
        } else if (sourceValue !== undefined) {
          // Assign non-object values
          target[key] = sourceValue;
        }
      }
    }
  }

  return target;
};

export {
  merge,
  pick,
  once,
  castArray,
  upperFirst,
  isObject,
  get,
  isPlainObject,
  getSystemInfo,
  format,
  truncateLines,
  rejectAfter,
  reduceUntil,
  parseGitUrl,
  hasAccess,
  parseVersion,
  readJSON,
  fixArgs,
  e,
  touch
};
