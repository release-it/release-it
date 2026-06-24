import path from 'node:path';
import fs from 'node:fs'; // import fs here so it can be stubbed in tests
import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { glob } from 'tinyglobby';
import Release from '../GitRelease.js';
import { format, e, castArray } from '../../util.js';
import prompts from './prompts.js';

const docs = 'https://git.io/release-it-gitlab';

const noop = Promise.resolve();

const createMultipartBody = (fieldName, filename, data) => {
  const boundary = `----release-it-${Date.now()}`;
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  return {
    body: Buffer.concat([Buffer.from(header), data, Buffer.from(footer)]),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
};

const readResponseBody = response =>
  new Promise((resolve, reject) => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => resolve(Buffer.concat(chunks).toString()));
    response.on('error', reject);
  });

const httpsRequest = (url, { method, headers, body, agent }) =>
  new Promise((resolve, reject) => {
    const urlObject = new URL(url);
    const transport = urlObject.protocol === 'https:' ? https : http;
    const request = transport.request(
      urlObject,
      {
        method,
        headers,
        agent: urlObject.protocol === 'https:' ? agent : undefined
      },
      async response => {
        try {
          const text = await readResponseBody(response);
          let parsed = text;

          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = text;
            }
          }

          if (response.statusCode >= 400) {
            reject(new Error(typeof parsed === 'object' && parsed !== null ? parsed.error : text));
            return;
          }

          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      }
    );

    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });

class GitLab extends Release {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
    this.assets = [];
    const { secure } = this.options;
    const certificateAuthorityFileRef = this.options.certificateAuthorityFileRef || 'CI_SERVER_TLS_CA_FILE';
    const certificateAuthorityFile =
      this.options.certificateAuthorityFile || process.env[certificateAuthorityFileRef] || null;

    const needsCustomAgent = Boolean(secure === false || certificateAuthorityFile);

    this.httpsAgent = needsCustomAgent
      ? new https.Agent({
          rejectUnauthorized: secure,
          ca: certificateAuthorityFile ? fs.readFileSync(certificateAuthorityFile) : undefined
        })
      : undefined;
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
    const method = (options.method || 'POST').toUpperCase();
    const { tokenHeader } = this.options;
    const url = `${baseUrl}/${endpoint}${options.searchParams ? `?${new URLSearchParams(options.searchParams)}` : ''}`;
    const headers = {
      'user-agent': 'webpro/release-it',
      'Accept-Encoding': 'identity',
      [tokenHeader]: this.token
    };

    try {
      if (this.httpsAgent) {
        let body;
        if (options.multipart) {
          const { body: multipartBody, contentType } = createMultipartBody(
            options.multipart.name,
            options.multipart.filename,
            options.multipart.data
          );
          body = multipartBody;
          headers['Content-Type'] = contentType;
          headers['Content-Length'] = body.length;
        } else if (typeof options.json !== 'undefined') {
          body = JSON.stringify(options.json);
          headers['Content-Type'] = 'application/json';
          headers['Content-Length'] = Buffer.byteLength(body);
        } else if (options.body) {
          body = options.body;
          headers['Content-Type'] = 'text/plain';
          headers['Content-Length'] = body.length;
        }

        const responseBody = await httpsRequest(url, { method, headers, body, agent: this.httpsAgent });
        this.debug(responseBody);
        return responseBody;
      }

      if (!(options.body || options.multipart)) {
        headers['Content-Type'] = typeof options.json !== 'undefined' ? 'application/json' : 'text/plain';
      }

      let body;
      if (options.multipart) {
        const formData = new FormData();
        formData.set(
          options.multipart.name,
          new Blob([options.multipart.data]),
          options.multipart.filename
        );
        body = formData;
      } else if (options.json) {
        body = JSON.stringify(options.json);
      } else {
        body = options.body;
      }

      const response = await fetch(
        url,
        body || options.json
          ? {
              method,
              headers,
              body
            }
          : { method, headers }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error);
      }

      const responseBody = await response.json();
      this.debug(responseBody);
      return responseBody;
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
      const rawData = await readFile(filePath);
      const options = {
        multipart: { name: 'file', filename: name, data: rawData }
      };

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
