const createDebug = require('debug');
const parseArgs = require('yargs-parser');

const opts = parseArgs([].slice.call(process.argv, 2));

const debug = createDebug('release-it:catchall');
const debugConfig = createDebug('release-it:config');
const debugGit = createDebug('release-it:git');
const debugGithub = createDebug('release-it:github');
const debugNpm = createDebug('release-it:npm');
const debugVersion = createDebug('release-it:version');
const debugShell = createDebug('release-it:shell');

if (opts.debug) {
  createDebug.enable('release-it:*');
}

module.exports = {
  debug,
  debugConfig,
  debugGit,
  debugGithub,
  debugNpm,
  debugVersion,
  debugShell
};
