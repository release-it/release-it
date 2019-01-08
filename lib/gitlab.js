const got = require('got');
const _ = require('lodash');
const Release = require('./release');
const { format } = require('./util');
const { debugGitLab: debug } = require('./debug');
const { gitlab: defaults } = require('../conf/release-it.json');

const noop = Promise.resolve();

const NO_RETRIES_NEEDED = [400, 401, 404, 422];

class GitLab extends Release {
  constructor(...args) {
    super(...args);
    this.type = 'GitLab';
    this.options = _.defaults(this.options, defaults);
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

    return this.retry(async bail => {
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
    });
  }

  setReleaseUrl(version) {
    const { repository, host } = this.repo;
    const tag = format(this.options.tagName, { version });
    this.releaseUrl = `https://${host}/${repository}/tags/${tag}`;
  }
}

module.exports = GitLab;
