import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import open from 'open';
import { Octokit } from '@octokit/rest';
import { glob } from 'tinyglobby';
import mime from 'mime-types';
import retry from 'async-retry';
import newGithubReleaseUrl from 'new-github-release-url';
import { ProxyAgent } from 'proxy-agent';
import { format, parseVersion, readJSON, e, castArray } from '../../util.js';
import Release from '../GitRelease.js';
import prompts from './prompts.js';
import { getCommitsFromChangelog, getResolvedIssuesFromChangelog, searchQueries } from './util.js';

/**
 * @typedef {import('@octokit/rest').RestEndpointMethodTypes['repos']['createRelease']['parameters']} CreateReleaseOptions
 */

const pkg = readJSON(new URL('../../../package.json', import.meta.url));

const docs = 'https://git.io/release-it-github';

const RETRY_CODES = [408, 413, 429, 500, 502, 503, 504, 521, 522, 524];

const DEFAULT_RETRY_MIN_TIMEOUT = 1000;

const parseErrormsg = err => {
  let msg = err;
  if (err instanceof Error) {
    const { status, message } = err;
    const headers = err.response ? err.response.headers : {};
    msg = `${headers?.status || status} (${message})`;
  }
  return msg;
};

const truncateBody = body => {
  // https://github.com/release-it/release-it/issues/965
  if (body && body.length >= 124000) return body.substring(0, 124000) + '...';
  return body;
};

class GitHub extends Release {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
  }

  async init() {
    await super.init();

    const { skipChecks, tokenRef, web, update, assets } = this.options;

    if (!this.token || web) {
      if (!web) {
        this.log.warn(`Environment variable "${tokenRef}" is required for automated GitHub Releases.`);
        this.log.warn('Falling back to web-based GitHub Release.');
      }
      this.setContext({ isWeb: true });
      return;
    }

    if (web && assets) {
      this.log.warn('Assets are not included in web-based releases.');
    }

    if (!skipChecks) {
      // If we're running on GitHub Actions, we can skip the authentication and
      // collaborator checks. Ref: https://bit.ly/2vsyRzu
      if (process.env.GITHUB_ACTIONS) {
        this.setContext({ username: process.env.GITHUB_ACTOR });
      } else {
        if (!(await this.isAuthenticated())) {
          throw e(`Could not authenticate with GitHub using environment variable "${tokenRef}".`, docs);
        }

        if (!(await this.isCollaborator())) {
          const { repository } = this.getContext('repo');
          const { username } = this.getContext();
          throw e(`User ${username} is not a collaborator for ${repository}.`, docs);
        }
      }
    }

    if (update) {
      const { latestTag } = this.config.getContext();
      try {
        const { id, upload_url, tag_name } = await this.getLatestRelease();
        if (latestTag === tag_name) {
          this.setContext({ isUpdate: true, isReleased: true, releaseId: id, upload_url });
        } else {
          this.setContext({ isUpdate: false });
        }
      } catch (error) {
        this.setContext({ isUpdate: false });
      }
      if (!this.getContext('isUpdate')) {
        this.log.warn(`GitHub release for tag ${latestTag} was not found. Creating new release.`);
      }
    }
  }

  async isAuthenticated() {
    if (this.config.isDryRun) return true;
    try {
      this.log.verbose('octokit users#getAuthenticated');
      const { data } = await this.client.users.getAuthenticated();
      this.setContext({ username: data.login });
      return true;
    } catch (err) {
      this.debug(err);
      return false;
    }
  }

  async isCollaborator() {
    if (this.config.isDryRun) return true;
    const { owner, project: repo } = this.getContext('repo');
    const { username } = this.getContext();
    try {
      const options = { owner, repo, username };
      this.log.verbose(`octokit repos#checkCollaborator (${username})`);
      await this.client.repos.checkCollaborator(options);
      return true;
    } catch (err) {
      this.debug(err);
      return false;
    }
  }

  async release() {
    const { assets } = this.options;
    const { isWeb, isUpdate } = this.getContext();
    const { isCI } = this.config;

    const type = isUpdate ? 'update' : 'create';
    const publishMethod = `${type}Release`;

    if (isWeb) {
      const task = () => this.createWebRelease();
      return this.step({ task, label: 'Generating link to GitHub Release web interface', prompt: 'release' });
    } else if (isCI) {
      await this.step({ task: () => this[publishMethod](), label: `GitHub ${type} release` });
      await this.step({ enabled: assets, task: () => this.uploadAssets(), label: 'GitHub upload assets' });
      return this.step({
        task: () => (isUpdate ? Promise.resolve() : this.commentOnResolvedItems()),
        label: 'GitHub comment on resolved items'
      });
    } else {
      const release = async () => {
        await this[publishMethod]();
        await this.uploadAssets();
        return isUpdate ? Promise.resolve(true) : this.commentOnResolvedItems();
      };
      return this.step({ task: release, label: `GitHub ${type} release`, prompt: 'release' });
    }
  }

  handleError(err, bail) {
    const message = parseErrormsg(err);
    const githubError = new Error(message);
    this.log.verbose(err.errors);
    this.debug(err);
    if (!RETRY_CODES.includes(err.status)) {
      return bail(githubError);
    }
    throw githubError;
  }

  get client() {
    if (this._client) return this._client;
    const { proxy, timeout } = this.options;
    const repo = this.getContext('repo');
    const host = this.options.host || repo.host;
    const isGitHub = host === 'github.com';
    const baseUrl = `https://${isGitHub ? 'api.github.com' : host}${isGitHub ? '' : '/api/v3'}`;
    const options = {
      baseUrl,
      auth: `token ${this.token}`,
      userAgent: `release-it/${pkg.version}`,
      log: this.config.isDebug ? console : {},
      request: {
        timeout
      }
    };

    if (proxy) {
      options.request.agent = new ProxyAgent(proxy);
    }

    const client = new Octokit(options);

    this._client = client;
    return client;
  }

  async getLatestRelease() {
    const { owner, project: repo } = this.getContext('repo');
    try {
      const options = { owner, repo };
      this.debug(options);
      const response = await this.client.repos.listReleases({ owner, repo, per_page: 1, page: 1 });
      this.debug(response.data[0]);
      return response.data[0];
    } catch (err) {
      return this.handleError(err, () => {});
    }
  }

  async getOctokitReleaseOptions(options = {}) {
    const { owner, project: repo } = this.getContext('repo');
    const {
      releaseName,
      draft = false,
      preRelease = false,
      autoGenerate = false,
      makeLatest = true,
      discussionCategoryName = undefined
    } = this.options;
    const { tagName } = this.config.getContext();
    const { version, releaseNotes, isUpdate } = this.getContext();
    const { isPreRelease } = parseVersion(version);
    const name = format(releaseName, this.config.getContext());
    const releaseNotesObject = this.options.releaseNotes;

    const body = autoGenerate
      ? isUpdate
        ? null
        : ''
      : truncateBody(releaseNotesObject?.commit ? await this.renderReleaseNotes(releaseNotesObject) : releaseNotes);

    /**
     * @type {CreateReleaseOptions}
     */
    const contextOptions = {
      owner,
      make_latest: makeLatest.toString(),
      repo,
      tag_name: tagName,
      name,
      body,
      draft,
      prerelease: isPreRelease || preRelease,
      generate_release_notes: autoGenerate,
      discussion_category_name: discussionCategoryName
    };
    return Object.assign(options, contextOptions);
  }

  retry(fn) {
    const { retryMinTimeout } = this.options;
    return retry(fn, {
      retries: 2,
      minTimeout: typeof retryMinTimeout === 'number' ? retryMinTimeout : DEFAULT_RETRY_MIN_TIMEOUT
    });
  }

  async createRelease() {
    const options = await this.getOctokitReleaseOptions();
    const { isDryRun } = this.config;

    this.log.exec(`octokit repos.createRelease "${options.name}" (${options.tag_name})`, { isDryRun });

    if (isDryRun) {
      this.setContext({ isReleased: true, releaseUrl: this.getReleaseUrlFallback(options.tag_name) });
      return true;
    }

    return this.retry(async bail => {
      try {
        this.debug(options);
        const response = await this.client.repos.createRelease(options);
        this.debug(response.data);
        const { html_url, upload_url, id, discussion_url } = response.data;
        this.setContext({
          isReleased: true,
          releaseId: id,
          releaseUrl: html_url,
          upload_url,
          discussionUrl: discussion_url
        });
        this.config.setContext({
          isReleased: true,
          releaseId: id,
          releaseUrl: html_url,
          upload_url,
          discussionUrl: discussion_url
        });
        this.log.verbose(`octokit repos.createRelease: done (${response.headers.location})`);
        return response.data;
      } catch (err) {
        return this.handleError(err, bail);
      }
    });
  }

  uploadAsset(filePath) {
    const url = this.getContext('upload_url');
    const name = path.basename(filePath);
    const contentType = mime.contentType(name) || 'application/octet-stream';
    const contentLength = statSync(filePath).size;

    return this.retry(async bail => {
      try {
        const options = {
          url,
          data: createReadStream(filePath),
          name,
          headers: {
            'content-type': contentType,
            'content-length': contentLength
          }
        };
        this.debug(options);
        const response = await this.client.repos.uploadReleaseAsset(options);
        this.debug(response.data);
        this.log.verbose(`octokit repos.uploadReleaseAsset: done (${response.data.browser_download_url})`);
        return response.data;
      } catch (err) {
        return this.handleError(err, bail);
      }
    });
  }

  uploadAssets() {
    const { assets } = this.options;
    const { isReleased } = this.getContext();
    const context = this.config.getContext();
    const { isDryRun } = this.config;

    const patterns = castArray(assets).map(pattern => format(pattern, context));

    this.log.exec('octokit repos.uploadReleaseAssets', patterns, { isDryRun });

    if (!assets || !isReleased) {
      return true;
    }

    return glob(patterns).then(files => {
      if (!files.length) {
        this.log.warn(`octokit repos.uploadReleaseAssets: did not find "${assets}" relative to ${process.cwd()}`);
      }

      if (isDryRun) return Promise.resolve();

      return Promise.all(files.map(filePath => this.uploadAsset(filePath)));
    });
  }

  getReleaseUrlFallback(tagName) {
    const { host, repository } = this.getContext('repo');
    return `https://${host}/${repository}/releases/tag/${tagName}`;
  }

  async generateWebUrl() {
    const repo = this.getContext('repo');
    const host = this.options.host || repo.host;
    const isGitHub = host === 'github.com';
    const options = await this.getOctokitReleaseOptions();
    const url = newGithubReleaseUrl({
      user: options.owner,
      repo: options.repo,
      tag: options.tag_name,
      isPrerelease: options.prerelease,
      title: options.name,
      body: options.body
    });
    return isGitHub ? url : url.replace('github.com', host);
  }

  async createWebRelease() {
    const { isCI } = this.config;
    const { tagName } = this.config.getContext();
    const url = await this.generateWebUrl();
    if (isCI) {
      this.setContext({ isReleased: true, releaseUrl: url });
    } else {
      const isWindows = process.platform === 'win32';
      if (isWindows) this.log.info(`Opening ${url}`);
      await open(url, { wait: isWindows });
      this.setContext({ isReleased: true, releaseUrl: this.getReleaseUrlFallback(tagName) });
    }
  }

  async updateRelease() {
    const { isDryRun } = this.config;
    const release_id = this.getContext('releaseId');
    const options = await this.getOctokitReleaseOptions({ release_id });

    this.log.exec(`octokit repos.updateRelease (${options.tag_name})`, { isDryRun });

    if (isDryRun) return true;

    return this.retry(async bail => {
      try {
        this.debug(options);
        const response = await this.client.repos.updateRelease(options);
        this.setContext({ releaseUrl: response.data.html_url });
        this.debug(response.data);
        this.log.verbose(`octokit repos.updateRelease: done (${response.headers.location})`);
        return true;
      } catch (err) {
        return this.handleError(err, bail);
      }
    });
  }

  async commentOnResolvedItems() {
    const { isDryRun } = this.config;
    const { host, owner, project: repo } = this.getContext('repo');
    const changelog = await this.getChangelog();
    const { comments } = this.options;
    const { submit, issue, pr } = comments ?? {};
    const context = this.getContext();

    if (!submit || !changelog) return true;

    const shas = getCommitsFromChangelog(changelog);
    const searchResults = await Promise.all(searchQueries(this.client, owner, repo, shas));
    const mergedPullRequests = searchResults.flatMap(items => items.map(item => ({ type: 'pr', number: item.number })));

    const hostURL = 'https://' + (this.options.host || host);
    const resolvedIssues = getResolvedIssuesFromChangelog(hostURL, owner, repo, changelog);

    for (const item of [...resolvedIssues, ...mergedPullRequests]) {
      const { type, number } = item;
      const comment = format(format(type === 'pr' ? pr : issue, context), context);
      const url = `${hostURL}/${owner}/${repo}/${type === 'pr' ? 'pull' : 'issues'}/${number}`;

      if (isDryRun) {
        this.log.exec(`octokit issues.createComment (${url})`, { isDryRun });
        return Promise.resolve();
      }

      try {
        await this.client.issues.createComment({ owner, repo, issue_number: number, body: comment });
        this.log.log(`● Commented on ${url}`);
      } catch (error) {
        this.log.log(`✕ Failed to comment on ${url}`);
      }
    }
  }

  async getCommits() {
    const { owner, project: repo } = this.getContext('repo');
    const { latestTag } = this.config.getContext();
    this.debug({ owner, repo, base: latestTag, head: 'HEAD' });
    const { data } = await this.client.repos.compareCommits({ owner, repo, base: latestTag, head: 'HEAD' });
    return data.commits;
  }

  async renderReleaseNotes(releaseNotes) {
    const { commit: template, excludeMatches = [] } = releaseNotes;
    const commits = await this.getCommits();

    if (this.options.commit) commits.pop();

    return commits
      .map(commit => {
        commit.commit.subject = commit.commit.message.split('\n')[0];
        const partial = template.replace(/(?<!\$)\{((?:[^{}]|\${[^}]+})+)\}/g, (_, block) => {
          const rendered = format(block, commit);
          return excludeMatches.some(match => rendered.includes(match)) ? '' : rendered;
        });
        return format(partial, commit);
      })
      .join('\n');
  }
}

export default GitHub;
