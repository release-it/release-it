const createDebug = require('debug');
const parseArgs = require('yargs-parser');

const opts = parseArgs([].slice.call(process.argv, 2));

module.exports = {
  debug: createDebug('release-it:catchall'),
  debugConfig: createDebug('release-it:config'),
  debugGit: createDebug('release-it:git'),
  debugShell: createDebug('release-it:shell'),
  debugGithubClient: createDebug('release-it:github-client'),
  debugGithubApi: createDebug('release-it:github-api')
}

if (opts.debug) {
  [debug, debugConfig, debugGit, debugShell, debugGithubClient, debugGithubApi].forEach(d => (d.enabled = true));
}
