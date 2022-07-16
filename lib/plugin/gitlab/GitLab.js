import fs from 'node:fs';
import path from 'node:path';
import got from 'got';
import { globby } from 'globby';
import FormData from 'form-data';
import allSettled from 'promise.allsettled';
import _ from 'lodash';
import Release from '../GitRelease.js';
import { format, e } from '../../util.js';
import prompts from './prompts.js';

const docs = 'https://git.io/release-it-gitlab';

const noop = Promise.resolve();

class GitLab extends Release {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
    this.assets = [];
    const { certificateAuthorityFile } = this.options;
    this.certificateAuthorityOption = certificateAuthorityFile
      ? { https: { certificateAuthority: fs.readFileSync(certificateAuthorityFile) } }
      : {};
  }

  get client() {
    if (this._client) return this._client;
    const { tokenHeader } = this.options;
    const { baseUrl } = this.getContext();
    this._client = got.extend({
      prefixUrl: baseUrl,
      method: 'POST',
      headers: {
        'user-agent': 'webpro/release-it',
        [tokenHeader]: this.token
      },
      ...this.certificateAuthorityOption
    });
    return this._client;
  }

  async init() {
    await super.init();

    const { skipChecks, tokenRef, tokenHeader } = this.options;
    const { repo } = this.getContext();
    const hasJobToken = (tokenHeader || '').toLowerCase() === 'job-token';
    const origin = this.options.origin || `https://${repo.host}`;
    this.setContext({
      id: encodeURIComponent(repo.repository),
      origin,
      baseUrl: `${origin}/api/v4`
    });

    if (skipChecks) return;

    if (!this.token) {
      throw e(`Environment variable "${tokenRef}" is required for GitLab releases.`, docs);
    }

    if (!hasJobToken) {
      if (!(await this.isAuthenticated())) {
        throw e(`Could not authenticate with GitLab using environment variable "${tokenRef}".`, docs);
      }
      if (!(await this.isCollaborator())) {
        const { user, repo } = this.getContext();
        throw e(`User ${user.username} is not a collaborator for ${repo.repository}.`, docs);
      }
    }
  }

  async isAuthenticated() {
    if (this.config.isDryRun) return true;
    const endpoint = `user`;
    try {
      const { id, username } = await this.request(endpoint, { method: 'GET' });
      this.setContext({ user: { id, username } });
      return true;
    } catch (err) {
      this.debug(err);
      return false;
    }
  }

  async isCollaborator() {
    if (this.config.isDryRun) return true;
    const { id, user } = this.getContext();
    const endpoint = `projects/${id}/members/all/${user.id}`;
    try {
      const { access_level } = await this.request(endpoint, { method: 'GET' });
      return access_level && access_level >= 30;
    } catch (err) {
      this.debug(err);
      return false;
    }
  }

  async beforeRelease() {
    await super.beforeRelease();
    await this.checkReleaseMilestones();
  }

  async checkReleaseMilestones() {
    if (this.options.skipChecks) return;

    const releaseMilestones = this.getReleaseMilestones();
    if (releaseMilestones.length < 1) {
      return;
    }

    this.log.exec(`gitlab releases#checkReleaseMilestones`);

    const { id } = this.getContext();
    const endpoint = `projects/${id}/milestones`;
    const requests = releaseMilestones.map(milestone => {
      const options = {
        method: 'GET',
        searchParams: {
          title: milestone,
          include_parent_milestones: true
        }
      };
      return this.request(endpoint, options).then(response => {
        if (!Array.isArray(response)) {
          const { baseUrl } = this.getContext();
          throw new Error(
            `Unexpected response from ${baseUrl}/${endpoint}. Expected an array but got: ${JSON.stringify(response)}`
          );
        }
        if (response.length === 0) {
          const error = new Error(`Milestone '${milestone}' does not exist.`);
          this.log.warn(error.message);
          throw error;
        }
        this.log.verbose(`gitlab releases#checkReleaseMilestones: milestone '${milestone}' exists`);
      });
    });
    try {
      await allSettled(requests).then(results => {
        for (const result of results) {
          if (result.status === 'rejected') {
            throw e('Missing one or more milestones in GitLab. Creating a GitLab release will fail.', docs);
          }
        }
      });
    } catch (err) {
      this.debug(err);
      throw err;
    }
    this.log.verbose('gitlab releases#checkReleaseMilestones: done');
  }

  getReleaseMilestones() {
    const { milestones } = this.options;
    return (milestones || []).map(milestone => format(milestone, this.config.getContext()));
  }

  async release() {
    const glRelease = () => this.createRelease();
    const glUploadAssets = () => this.uploadAssets();

    if (this.config.isCI) {
      await this.step({ enabled: this.options.assets, task: glUploadAssets, label: 'GitLab upload assets' });
      return await this.step({ task: glRelease, label: 'GitLab release' });
    } else {
      const release = () => glUploadAssets().then(() => glRelease());
      return await this.step({ task: release, label: 'GitLab release', prompt: 'release' });
    }
  }

  async request(endpoint, options) {
    const { baseUrl } = this.getContext();
    this.debug(Object.assign({ url: `${baseUrl}/${endpoint}` }, options));
    const method = (options.method || 'POST').toLowerCase();
    const response = await this.client[method](endpoint, options);
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body || {};
    this.debug(body);
    return body;
  }

  async createRelease() {
    const { releaseName } = this.options;
    const { tagName } = this.config.getContext();
    const { id, releaseNotes, repo, origin } = this.getContext();
    const { isDryRun } = this.config;
    const name = format(releaseName, this.config.getContext());
    const description = releaseNotes || '-';
    const releaseUrl = `${origin}/${repo.repository}/-/releases`;
    const releaseMilestones = this.getReleaseMilestones();

    this.log.exec(`gitlab releases#createRelease "${name}" (${tagName})`, { isDryRun });

    if (isDryRun) {
      this.setContext({ isReleased: true, releaseUrl });
      return true;
    }

    const endpoint = `projects/${id}/releases`;
    const options = {
      json: {
        name,
        tag_name: tagName,
        description
      }
    };

    if (this.assets.length) {
      options.json.assets = {
        links: this.assets
      };
    }

    if (releaseMilestones.length) {
      options.json.milestones = releaseMilestones;
    }

    try {
      await this.request(endpoint, options);
      this.log.verbose('gitlab releases#createRelease: done');
      this.setContext({ isReleased: true, releaseUrl });
      return true;
    } catch (err) {
      this.debug(err);
      throw err;
    }
  }

  async uploadAsset(filePath) {
    const name = path.basename(filePath);
    const { id, origin, repo } = this.getContext();
    const endpoint = `projects/${id}/uploads`;

    const body = new FormData();
    body.append('file', fs.createReadStream(filePath));
    const options = { body };

    try {
      const body = await this.request(endpoint, options);
      this.log.verbose(`gitlab releases#uploadAsset: done (${body.url})`);
      this.assets.push({
        name,
        url: `${origin}/${repo.repository}${body.url}`
      });
    } catch (err) {
      this.debug(err);
      throw err;
    }
  }

  uploadAssets() {
    const { assets } = this.options;
    const { isDryRun } = this.config;
    const context = this.config.getContext();

    const patterns = _.castArray(assets).map(pattern => format(pattern, context));

    this.log.exec('gitlab releases#uploadAssets', patterns, { isDryRun });

    if (!assets || isDryRun) {
      return noop;
    }

    return globby(patterns).then(files => {
      if (!files.length) {
        this.log.warn(`gitlab releases#uploadAssets: could not find "${assets}" relative to ${process.cwd()}`);
      }
      return Promise.all(files.map(filePath => this.uploadAsset(filePath)));
    });
  }
}

export default GitLab;
