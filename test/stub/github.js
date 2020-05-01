const nock = require('nock');

const interceptAuthentication = ({ api = 'https://api.github.com', username = 'john' } = {}) =>
  nock(api).get('/user').reply(200, {
    login: username
  });

const interceptCollaborator = ({
  api = 'https://api.github.com',
  owner = 'user',
  project = 'repo',
  username = 'john'
} = {}) => nock(api).get(`/repos/${owner}/${project}/collaborators/${username}`).reply(204);

const interceptDraft = ({
  api = 'https://api.github.com',
  host = 'github.com',
  owner = 'user',
  project = 'repo',
  body: { tag_name, name = '', body = null, prerelease = false, draft = true }
} = {}) =>
  nock(api)
    .post(`/repos/${owner}/${project}/releases`, { tag_name, name, body, prerelease, draft })
    .reply(() => {
      const id = 1;
      const responseBody = {
        id,
        tag_name,
        name,
        body,
        prerelease,
        draft,
        upload_url: `https://uploads.${host}/repos/${owner}/${project}/releases/${id}/assets{?name,label}`,
        html_url: `https://${host}/${owner}/${project}/releases/tag/untagged-${tag_name}`,
        assets: []
      };
      return [200, responseBody, { location: `${api}/repos/${owner}/${project}/releases/${id}` }];
    });

const interceptReuse = ({
  api = 'https://api.github.com',
  host = 'github.com',
  owner = 'user',
  project = 'repo',
  body: { tag_name, name = '', body = null, prerelease = false, draft = true, asset }
} = {}) =>
  nock(api)
    .get(`/repos/${owner}/${project}/releases`)
    .reply(() => {
      const id = 1;
      const responseBody = [
        {
          id,
          tag_name,
          name,
          body,
          prerelease,
          draft,
          upload_url: `https://uploads.${host}/repos/${owner}/${project}/releases/${id}/assets{?name,label}`,
          html_url: `https://${host}/${owner}/${project}/releases/tag/untagged-${tag_name}`,
          assets: asset ? [{ name: asset }] : []
        }
      ];
      return [200, responseBody, { location: `${api}/repos/${owner}/${project}/releases/${id}` }];
    });

const interceptPublish = ({
  host = 'github.com',
  api = 'https://api.github.com',
  owner = 'user',
  project = 'repo',
  body: { tag_name, draft = false }
} = {}) =>
  nock(api)
    .patch(`/repos/${owner}/${project}/releases/1`, { tag_name, draft })
    .reply(200, {
      draft: false,
      html_url: `https://${host}/${owner}/${project}/releases/tag/${tag_name}`
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
    .reply(200, function () {
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

module.exports = {
  interceptAuthentication,
  interceptCollaborator,
  interceptDraft,
  interceptReuse,
  interceptPublish,
  interceptAsset
};
