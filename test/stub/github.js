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

const interceptListReleases = ({
  host = 'github.com',
  api = 'https://api.github.com',
  owner = 'user',
  project = 'repo',
  tag_name
} = {}) =>
  nock(api)
    .get(`/repos/${owner}/${project}/releases?per_page=1&page=1`)
    .reply(200, [
      {
        id: 1,
        upload_url: `https://uploads.${host}/repos/${owner}/${project}/releases/1/assets{?name,label}`,
        html_url: `https://${host}/${owner}/${project}/releases/tag/${tag_name}`
      }
    ]);

const interceptCreate = ({
  api = 'https://api.github.com',
  host = 'github.com',
  owner = 'user',
  project = 'repo',
  body: { tag_name, name = '', body = null, prerelease = false, draft = false }
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
        html_url: `https://${host}/${owner}/${project}/releases/tag/${tag_name}`
      };
      return [200, responseBody, { location: `${api}/repos/${owner}/${project}/releases/${id}` }];
    });

const interceptUpdate = ({
  host = 'github.com',
  api = 'https://api.github.com',
  owner = 'user',
  project = 'repo',
  body: { tag_name, name = '', body = null, prerelease = false, draft = false }
} = {}) =>
  nock(api)
    .patch(`/repos/${owner}/${project}/releases/1`, { tag_name, name, body, draft, prerelease })
    .reply(200, {
      id: 1,
      tag_name,
      name,
      body,
      prerelease,
      draft,
      upload_url: `https://uploads.${host}/repos/${owner}/${project}/releases/1/assets{?name,label}`,
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
  interceptListReleases,
  interceptCreate,
  interceptUpdate,
  interceptAsset
};
