// Totally much borrowed from https://github.com/semantic-release/github/blob/master/lib/success.js
import issueParser from 'issue-parser';

/** @internal */
export const getSearchQueries = (base, commits, separator = '+') => {
  const encodedSeparator = encodeURIComponent(separator);

  return commits.reduce((searches, commit) => {
    const lastSearch = searches[searches.length - 1];
    if (lastSearch && encodeURIComponent(lastSearch).length + commit.length <= 256 - encodedSeparator.length) {
      searches[searches.length - 1] = `${lastSearch}${separator}${commit}`;
    } else {
      searches.push(`${base}${separator}${commit}`);
    }

    return searches;
  }, []);
};

export const searchQueries = (client, owner, repo, shas) =>
  getSearchQueries(`repo:${owner}/${repo}+type:pr+is:merged`, shas).map(
    async q => (await client.search.issuesAndPullRequests({ q, advanced_search: true })).data.items
  );

export const getCommitsFromChangelog = changelog => {
  const regex = /\(([a-f0-9]{7,})\)/i;
  return changelog.split('\n').flatMap(message => {
    const match = message.match(regex);
    if (match) return match[1];
    return [];
  });
};

export const getResolvedIssuesFromChangelog = (host, owner, repo, changelog) => {
  const parser = issueParser('github', { hosts: [host] });
  return changelog
    .split('\n')
    .map(parser)
    .flatMap(parsed => parsed.actions.close)
    .filter(action => !action.slug || action.slug === `${owner}/${repo}`)
    .map(action => ({ type: 'issue', number: parseInt(action.issue, 10) }));
};
