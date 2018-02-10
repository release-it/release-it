const createDebug = require('debug');
const parseArgs = require('yargs-parser');

const opts = parseArgs([].slice.call(process.argv, 2));

const debug = createDebug('release-it:catchall');
const debugConfig = createDebug('release-it:config');
const debugGit = createDebug('release-it:git');
const debugShell = createDebug('release-it:shell');

if (opts.debug) {
  [debug, debugConfig, debugGit, debugShell].forEach(d => (d.enabled = true));
}

module.exports = {
  debug,
  debugConfig,
  debugGit,
  debugShell
};
