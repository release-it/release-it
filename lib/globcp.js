const fs = require('graceful-fs'), // Contains fix for the EMFILE (too many open files) issue
  path = require('path'),
  glob = require('glob'),
  mkdirp = require('mkdirp'),
  when = require('when'),
  fn = require('when/node');

/**
 * Glob files, then copy matches to target asynchronously.
 * Uses [node-glob](https://github.com/isaacs/node-glob) and [mkdirp](https://github.com/substack/node-mkdirp).
 * Returns a promise that resolves when all dirs and files have been copied.
 *
 * Example call:
 *
 * - `globcp('** /*.txt', targetDir);`
 * - `globcp(['** /*.js', '** /*.json'], {cwd: baseDir}, targetDir);`
 * - `globcp({'dist/': ['** /*.js'], './': ['** /bower.json']], null, targetDir);`
 *
 * @param {String|Array|Object} patterns Pattern or array of patterns to glob, or object of patterns (with keys
 * as `cwd` for the (array of) pattern(s) it holds), see example.
 * @param {Object} options Options object passed as-is to glob
 * @param {String} target Target dir to copy matched dirs and files to
 * @returns {Promise}
 */

function globcp(patterns, options, target) {
  if(!target) {
    target = options;
  }

  const dirCache = {},
    patternBaseDefault = './';
  var patternObj = {};

  if(typeof patterns === 'string' || Array.isArray(patterns)) {
    patternObj[options.cwd || patternBaseDefault] = typeof patterns === 'string' ? [patterns] : patterns;
  } else {
    patternObj = patterns;
  }

  function mkdirAsync(path) {
    return dirCache[path] || (dirCache[path] = fn.call(mkdirp, path));
  }

  function copyAsync(source, target) {
    return mkdirAsync(path.dirname(target)).then(() => new Promise((resolve, reject) => {
      const is = fs.createReadStream(source),
        os = fs.createWriteStream(target);
      is.pipe(os);
      os.on('close', error => {
        if(error) {
          reject(error);
        }
        resolve(target);
      });
    }));
  }

  return when.map(Object.keys(patternObj), patternBase => when.map(patternObj[patternBase], pattern => fn.call(glob, pattern, {cwd: patternBase})
    .then(matches => when.map(matches, match => {
      const src = path.resolve(patternBase, match);
      return fn.call(fs.stat, src).then(stat => {
        const dst = path.resolve(target, match);
        if(stat.isDirectory()) {
          return mkdirAsync(dst);
        } else {
          return copyAsync(src, dst);
        }
      });
    }))
  ));
}

module.exports = globcp;
