import createDebug from 'debug';

export const debug = createDebug('release-it:catchall');
export const debugConfig = createDebug('release-it:config');
export const debugGit = createDebug('release-it:git');
export const debugShell = createDebug('release-it:shell');
export const debugGithubClient = createDebug('release-it:github-client');
export const debugGithubApi = createDebug('release-it:github-api');
