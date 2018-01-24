const createDebug = require('debug');
const parseArgs = require('yargs-parser');

const opts = parseArgs([].slice.call(process.argv, 2));

const debug = createDebug('release-it:catchall');
const debugConfig = createDebug('release-it:config');
const debugGit = createDebug('release-it:git');
const debugShell = createDebug('release-it:shell');
const debugGithubClient = createDebug('release-it:github-client');

if (opts.debug) {
  [debug, debugConfig, debugGit, debugShell, debugGithubClient].forEach(d => (d.enabled = true));
}

module.exports = {
  debug,
  debugConfig,
  debugGit,
  debugShell,
  debugGithubClient
};
