import nock from 'nock';

export let interceptUser = ({ host = 'https://gitlab.com', owner = 'user' } = {}, options) =>
  nock(host, options).get('/api/v4/user').reply(200, { id: 1, username: owner });

export let interceptCollaborator = (
  { host = 'https://gitlab.com', owner = 'user', project = 'repo', group, userId = 1 } = {},
  options
) =>
  nock(host, options)
    .get(`/api/v4/projects/${group ? `${group}%2F` : ''}${owner}%2F${project}/members/all/${userId}`)
    .reply(200, { id: userId, username: owner, access_level: 30 });

export let interceptPublish = ({ host = 'https://gitlab.com', owner = 'user', project = 'repo', body } = {}, options) =>
  nock(host, options)
    .post(`/api/v4/projects/${owner}%2F${project}/releases`, body)
    .reply(200, {
      _links: {
        self: `https://gitlab.com/${owner}/${project}/-/releases/${body?.tag_name ?? '1.0.0'}`
      }
    });

export let interceptMilestones = (
  { host = 'https://gitlab.com', owner = 'user', project = 'repo', query = {}, milestones = [] } = {},
  options
) =>
  nock(host, options)
    .get(`/api/v4/projects/${owner}%2F${project}/milestones`)
    .query(
      Object.assign(
        {
          include_parent_milestones: true
        },
        query
      )
    )
    .reply(200, JSON.stringify(milestones));

export let interceptAsset = ({ host = 'https://gitlab.com', owner = 'user', project = 'repo' } = {}) =>
  nock(host)
    .post(`/api/v4/projects/${owner}%2F${project}/uploads`)
    .query(true)
    .reply(200, (_, requestBody) => {
      const [, name] = requestBody.match(/filename="([^"]+)/);
      return {
        alt: name,
        url: `/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${name}`,
        full_path: `/-/project/1234/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${name}`,
        markdown: `[${name}](/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${name})`,
        _links: {
          self: `https://gitlab.com/${owner}/${project}/-/releases/${name}`
        }
      };
    });

export let interceptAssetGeneric = ({ host = 'https://gitlab.com', owner = 'user', project = 'repo' } = {}) =>
  nock(host)
    .put(`/api/v4/projects/${owner}%2F${project}/packages/generic/release-it/2.0.1/file-v2.0.1.txt`)
    .reply(200, () => {
      return {
        message: '201 Created'
      };
    });
