const nock = require('nock');

const interceptDraft = ({
  api = 'https://api.github.com',
  host = 'github.com',
  owner = 'user',
  project = 'repo',
  body: requestBody
} = {}) =>
  nock(api)
    .post(`/repos/${owner}/${project}/releases`, requestBody)
    .reply(() => {
      const id = 1;
      const { tag_name, name, body, prerelease, draft } = requestBody;
      const responseBody = {
        id,
        tag_name,
        name,
        body,
        prerelease,
        draft,
        upload_url: `https://uploads.${host}/repos/${owner}/${project}/releases/${id}/assets{?name,label}`,
        html_url: `https://${host}/${owner}/${project}/releases/tag/untagged-${tag_name}`
      };
      return [200, responseBody, { location: `${api}/repos/${owner}/${project}/releases/${id}` }];
    });

const interceptPublish = ({
  host = 'github.com',
  api = 'https://api.github.com',
  owner = 'user',
  project = 'repo',
  body = {}
} = {}) =>
  nock(api)
    .patch(`/repos/${owner}/${project}/releases/1`, body)
    .reply(200, {
      draft: false,
      html_url: `https://${host}/${owner}/${project}/releases/tag/${body.tag_name}`
    });

const interceptAsset = ({
  api = 'https://api.github.com',
  host = 'github.com',
  owner = 'user',
  project = 'repo',
  tagName,
  body = {}
} = {}) =>
  nock(`https://uploads.${host}`)
    .post(`/repos/${owner}/${project}/releases/1/assets`, body)
    .query(true)
    .reply(200, function() {
      const id = 1;
      const [, name] = this.req.path.match(/\?name=([^&]+)/);
      return {
        id,
        url: `${api}/repos/${owner}/${project}/releases/assets/${id}`,
        name,
        label: '',
        state: 'uploaded',
        size: this.req.headers['content-length'],
        browser_download_url: `https://${host}/${owner}/${project}/releases/download/${tagName}/${name}`
      };
    });

module.exports = { interceptDraft, interceptPublish, interceptAsset };
