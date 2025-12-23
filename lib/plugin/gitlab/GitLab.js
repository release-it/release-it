import path from 'node:path';
import fs from 'node:fs'; // import fs here so it can be stubbed in tests
import { readFile } from 'node:fs/promises';
import { glob } from 'tinyglobby';
import { Agent } from 'undici';
import Release from '../GitRelease.js';
import { format, e, castArray } from '../../util.js';
import prompts from './prompts.js';

const docs = 'https://git.io/release-it-gitlab';

const noop = Promise.resolve();

class GitLab extends Release {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
    this.assets = [];
    const { secure } = this.options;
    const certificateAuthorityFileRef = this.options.certificateAuthorityFileRef || 'CI_SERVER_TLS_CA_FILE';
    const certificateAuthorityFile =
      this.options.certificateAuthorityFile || process.env[certificateAuthorityFileRef] || null;
    this.certificateAuthorityOption = {};

    const needsCustomAgent = Boolean(secure === false || certificateAuthorityFile);

    if (needsCustomAgent) {
      this.certificateAuthorityOption.dispatcher = new Agent({
        connect: {
          rejectUnauthorized: secure,
          ca: certificateAuthorityFile ? fs.readFileSync(certificateAuthorityFile) : undefined
        }
      });
    }
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
      await Promise.allSettled(requests).then(results => {
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
    const { tokenHeader } = this.options;
    const url = `${baseUrl}/${endpoint}${options.searchParams ? `?${new URLSearchParams(options.searchParams)}` : ''}`;
    const headers = {
      'user-agent': 'webpro/release-it',
      [tokenHeader]: this.token
    };
    // When using fetch() with FormData bodies, we should not set the Content-Type header.
    // See: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects#sending_files_using_a_formdata_object
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = typeof options.json !== 'undefined' ? 'application/json' : 'text/plain';
    }
    const requestOptions = {
      method,
      headers,
      ...this.certificateAuthorityOption
    };

    try {
      const response = await fetch(
        url,
        options.json || options.body
          ? {
              ...requestOptions,
              body: options.json ? JSON.stringify(options.json) : options.body
            }
          : requestOptions
      );

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }

      const body = await response.json();
      this.debug(body);
      return body;
    } catch (err) {
      this.debug(err);
      throw err;
    }
  }

  async createRelease() {
    const { releaseName } = this.options;
    const { tagName, branchName, git: { tagAnnotation } = {} } = this.config.getContext();
    const { id, releaseNotes, repo, origin } = this.getContext();
    const { isDryRun } = this.config;
    const name = format(releaseName, this.config.getContext());
    const tagMessage = format(tagAnnotation, this.config.getContext());
    const description = releaseNotes || '-';
    const releaseUrl = `${origin}/${repo.repository}/-/releases/${tagName}`;
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
        ref: branchName,
        tag_name: tagName,
        tag_message: tagMessage,
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
      const body = await this.request(endpoint, options);
      const releaseUrlSelf = body._links?.self ?? releaseUrl;
      this.log.verbose('gitlab releases#createRelease: done');
      this.setContext({ isReleased: true, releaseUrl: releaseUrlSelf });
      this.config.setContext({ isReleased: true, releaseUrl: releaseUrlSelf });
      return true;
    } catch (err) {
      this.debug(err);
      throw err;
    }
  }

  async uploadAsset(filePath) {
    const name = path.basename(filePath);
    const { useIdsForUrls, useGenericPackageRepositoryForAssets, genericPackageRepositoryName } = this.options;
    const { id, origin, repo, version, baseUrl } = this.getContext();

    const endpoint = useGenericPackageRepositoryForAssets
      ? `projects/${id}/packages/generic/${genericPackageRepositoryName}/${version}/${name}`
      : `projects/${id}/uploads`;

    if (useGenericPackageRepositoryForAssets) {
      const options = {
        method: 'PUT',
        body: await readFile(filePath)
      };

      try {
        const body = await this.request(endpoint, options);
        if (!(body.message && body.message == '201 Created')) {
          throw new Error(`GitLab asset upload failed`);
        }
        this.log.verbose(`gitlab releases#uploadAsset: done (${endpoint})`);
        this.assets.push({
          name,
          url: `${baseUrl}/${endpoint}`
        });
      } catch (err) {
        this.debug(err);
        throw err;
      }
    } else {
      const body = new FormData();
      const rawData = await readFile(filePath);
      body.set('file', new Blob([rawData]), name);
      const options = { body };

      try {
        const body = await this.request(endpoint, options);
        this.log.verbose(`gitlab releases#uploadAsset: done (${body.url})`);
        this.assets.push({
          name,
          url: useIdsForUrls ? `${origin}${body.full_path}` : `${origin}/${repo.repository}${body.url}`
        });
      } catch (err) {
        this.debug(err);
        throw err;
      }
    }
  }

  uploadAssets() {
    const { assets } = this.options;
    const { isDryRun } = this.config;
    const context = this.config.getContext();

    const patterns = castArray(assets).map(pattern => format(pattern, context));

    this.log.exec('gitlab releases#uploadAssets', patterns, { isDryRun });

    if (!assets) {
      return noop;
    }

    return glob(patterns).then(files => {
      if (!files.length) {
        this.log.warn(`gitlab releases#uploadAssets: could not find "${assets}" relative to ${process.cwd()}`);
      }

      if (isDryRun) return Promise.resolve();

      return Promise.all(files.map(filePath => this.uploadAsset(filePath)));
    });
  }
}

export default GitLab;
