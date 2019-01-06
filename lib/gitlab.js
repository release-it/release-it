const got = require('got');
const retry = require('async-retry');
const _ = require('lodash');
const repoPathParse = require('parse-repo');
const Log = require('./log');
const Changelog = require('./changelog');
const { format } = require('./util');
const { GitLabTokenError } = require('./errors');
const { debugGitLab: debug } = require('./debug');
const { gitlab: defaults } = require('../conf/release-it.json');

const noop = Promise.resolve();

const NO_RETRIES_NEEDED = [400, 401, 404, 422];

class GitLab {
  constructor(...args) {
    const options = Object.assign({}, ...args);
    this.options = _.defaults(options, defaults);
    this.repo = repoPathParse(options.remoteUrl);
    this.log = options.log || new Log();
    this.changelogs = options.changelogs || new Changelog();
  }

  validate() {
    if (!this.options.release) return;
    if (!this.token) {
      throw new GitLabTokenError(this.options.tokenRef);
    }
  }

  get token() {
    const { tokenRef } = this.options;
    return _.get(process.env, tokenRef, null);
  }

  async getNotes() {
    const { releaseNotes } = this.options;
    return releaseNotes ? await this.changelogs.create(releaseNotes) : null;
  }

  async release({ version, changelog }) {
    const { tagName, releaseName, releaseNotes } = this.options;
    const tag_name = format(tagName, { version });
    const name = format(releaseName, { version });
    const description = releaseNotes ? await this.changelogs.create(releaseNotes) : changelog;

    this.log.exec(`gitlab releases#createRelease "${name}" (${tag_name})`);

    if (this.options.isDryRun) {
      this.log.dry();
      this.setReleaseUrl(version);
      this.isReleased = true;
      return noop;
    }

    const { repository, host } = this.repo;
    const id = encodeURIComponent(repository);

    const base = `https://${host}/api/v4`;
    const endpoint = `/projects/${id}/repository/tags/${tag_name}/release`;
    const url = `${base}${endpoint}`;

    const body = {
      description
    };

    const options = {
      method: 'POST',
      json: true,
      body,
      headers: {
        'user-agent': 'webpro/release-it',
        'Private-Token': this.token
      }
    };

    return retry(
      async bail => {
        try {
          debug(Object.assign({ url }, options));
          const response = await got(url, options);
          debug(response.body);
          this.log.verbose(`gitlab releases#createRelease: done`);
          this.setReleaseUrl(version);
          this.isReleased = true;
          return response.body;
        } catch (err) {
          debug(err);
          if (_.includes(NO_RETRIES_NEEDED, err.statusCode)) {
            return bail(err);
          }
          throw err;
        }
      },
      {
        retries: 2
      }
    );
  }

  setReleaseUrl(version) {
    const { repository, host } = this.repo;
    const tag = format(this.options.tagName, { version });
    this.releaseUrl = `https://${host}/${repository}/tags/${tag}`;
  }

  getReleaseUrl() {
    return this.releaseUrl;
  }
}

module.exports = GitLab;
