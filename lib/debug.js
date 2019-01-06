const createDebug = require('debug');
const parseArgs = require('yargs-parser');

const opts = parseArgs([].slice.call(process.argv, 2));

const debug = createDebug('release-it:catchall');
const debugConfig = createDebug('release-it:config');
const debugGit = createDebug('release-it:git');
const debugGitHub = createDebug('release-it:github');
const debugGitLab = createDebug('release-it:gitlab');
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
  debugGitHub,
  debugGitLab,
  debugNpm,
  debugVersion,
  debugShell
};
