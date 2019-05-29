const nock = require('nock');

module.exports.interceptPublish = ({ host = 'https://gitlab.com', owner = 'user', project = 'repo', body } = {}) =>
  nock(host)
    .post(`/api/v4/projects/${owner}%2F${project}/releases`, body)
    .reply(200, {});

module.exports.interceptAsset = ({ host = 'https://gitlab.com', owner = 'user', project = 'repo' } = {}) =>
  nock(host)
    .post(`/api/v4/projects/${owner}%2F${project}/uploads`)
    .query(true)
    .reply(200, function(_, requestBody) {
      const [, name] = requestBody.match(/filename="([^"]+)/);
      return {
        alt: name,
        url: `/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${name}`,
        markdown: `[${name}](/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${name})`
      };
    });
