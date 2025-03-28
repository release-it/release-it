export const interceptMembers = (server, { owner = 'emma' } = {}) => {
  server.get(`/projects/john%2Frepo/members/all/1`, { status: 200, username: owner });
};

export const interceptUser = (server, { owner = 'user' } = {}, options = {}) => {
  server.get({ url: '/user', ...options }, { status: 200, body: { id: 1, username: owner } });
};

export const interceptCollaborator = (
  server,
  { owner = 'user', project = 'repo', group, userId = 1 } = {},
  options = {}
) =>
  server.get(
    {
      url: `/projects/${group ? `${group}%2F` : ''}${owner}%2F${project}/members/all/${userId}`,
      ...options
    },
    {
      status: 200,
      body: { id: userId, username: owner, access_level: 30 }
    }
  );

export const interceptPublish = (server, { owner = 'user', project = 'repo', body } = {}) =>
  server.post(
    { url: `/projects/${owner}%2F${project}/releases`, body },
    {
      status: 200,
      body: {
        _links: {
          self: `https://gitlab.com/${owner}/${project}/-/releases/${body?.tag_name ?? '1.0.0'}`
        }
      }
    }
  );

export const interceptMilestones = (server, { owner = 'user', project = 'repo', query = {}, milestones = [] } = {}) =>
  server.get(
    {
      url: `/projects/${owner}%2F${project}/milestones`,
      query: {
        include_parent_milestones: 'true',
        ...query
      }
    },
    {
      status: 200,
      body: milestones
    }
  );

export const interceptAsset = (server, { owner = 'user', project = 'repo' } = {}) =>
  server.post(
    {
      url: `/projects/${owner}%2F${project}/uploads`
    },
    async request => {
      const formData = await request.formData();
      const { name } = formData.get('file');
      return {
        status: 200,
        body: {
          alt: name,
          url: `/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${name}`,
          full_path: `/-/project/1234/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${name}`,
          markdown: `[${name}](/uploads/7e8bec1fe27cc46a4bc6a91b9e82a07c/${name})`,
          _links: {
            self: `https://gitlab.com/${owner}/${project}/-/releases/${name}`
          }
        }
      };
    }
  );

export const interceptAssetGeneric = (server, { owner = 'user', project = 'repo' } = {}) =>
  server.put(
    {
      url: `/projects/${owner}%2F${project}/packages/generic/release-it/2.0.1/file-v2.0.1.txt`
    },
    {
      status: 200,
      body: {
        message: '201 Created'
      }
    }
  );
