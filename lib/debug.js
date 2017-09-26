import createDebug from 'debug';
import parseArgs from 'yargs-parser';

const opts = parseArgs([].slice.call(process.argv, 2));

export const debug = createDebug('release-it:catchall');
export const debugConfig = createDebug('release-it:config');
export const debugGit = createDebug('release-it:git');
export const debugShell = createDebug('release-it:shell');
export const debugGithubClient = createDebug('release-it:github-client');
export const debugGithubApi = createDebug('release-it:github-api');

if (opts.debug) {
  [debug, debugConfig, debugGit, debugShell, debugGithubClient, debugGithubApi].forEach(d => (d.enabled = true));
}
