export const interceptAuthentication = (server, { username = 'john' } = {}) => {
  server.get('/user', { status: 200, body: { login: username } });
};

export const interceptCollaborator = (server, { owner = 'user', project = 'repo', username = 'john' } = {}) => {
  server.get(`/repos/${owner}/${project}/collaborators/${username}`, { status: 204 });
};

export const interceptListReleases = (
  server,
  { host = 'github.com', owner = 'user', project = 'repo', tag_name } = {}
) => {
  server.get(`/repos/${owner}/${project}/releases?per_page=1&page=1`, {
    status: 200,
    body: [
      {
        id: 1,
        upload_url: `https://uploads.${host}/repos/${owner}/${project}/releases/1/assets{?name,label}`,
        html_url: `https://${host}/${owner}/${project}/releases/tag/${tag_name}`,
        tag_name,
        target_commitish: 'main',
        name: `Release ${tag_name}`,
        body: 'Description of the release',
        draft: false,
        prerelease: false
      }
    ]
  });
};

export const interceptCreate = (
  server,
  {
    api = 'https://api.github.com',
    host = 'github.com',
    owner = 'user',
    project = 'repo',
    body: {
      tag_name,
      name = '',
      body = null,
      prerelease = false,
      draft = false,
      generate_release_notes = false,
      make_latest = 'true',
      discussion_category_name = undefined
    }
  } = {}
) => {
  const id = 1;
  server.post(
    {
      url: `/repos/${owner}/${project}/releases`,
      body: { tag_name, name, body, prerelease, draft, generate_release_notes, make_latest, discussion_category_name }
    },
    {
      status: 200,
      body: {
        id,
        tag_name,
        name,
        body,
        prerelease,
        draft,
        generate_release_notes,
        upload_url: `https://uploads.${host}/repos/${owner}/${project}/releases/${id}/assets{?name,label}`,
        html_url: `https://${host}/${owner}/${project}/releases/tag/${tag_name}`,
        discussion_url: discussion_category_name ? `https://${host}/${owner}/${project}/discussions/${id}` : undefined
      },
      headers: { location: `${api}/repos/${owner}/${project}/releases/${id}` }
    }
  );
};

export const interceptUpdate = (
  server,
  {
    host = 'github.com',
    owner = 'user',
    project = 'repo',
    body: {
      tag_name,
      name = '',
      body = null,
      prerelease = false,
      draft = false,
      generate_release_notes = false,
      make_latest = 'true',
      discussion_category_name = undefined
    }
  } = {}
) => {
  server.patch(
    {
      url: `/repos/${owner}/${project}/releases/1`,
      body: {
        tag_name,
        name,
        body,
        draft,
        prerelease,
        generate_release_notes,
        make_latest,
        discussion_category_name
      }
    },
    {
      status: 200,
      body: {
        id: 1,
        tag_name,
        name,
        body,
        prerelease,
        draft,
        generate_release_notes,
        upload_url: `https://uploads.${host}/repos/${owner}/${project}/releases/1/assets{?name,label}`,
        html_url: `https://${host}/${owner}/${project}/releases/tag/${tag_name}`
      }
    }
  );
};

export const interceptAsset = (
  server,
  { api = 'https://api.github.com', host = 'github.com', owner = 'user', project = 'repo', tagName } = {}
) => {
  server.post(
    {
      url: `/repos/${owner}/${project}/releases/1/assets`
    },
    request => {
      const id = 1;
      const url = new URL(request.url);
      const name = url.searchParams.get('name');
      return {
        status: 200,
        body: {
          id,
          url: `${api}/repos/${owner}/${project}/releases/assets/${id}`,
          name,
          label: '',
          state: 'uploaded',
          size: request.headers['content-length'],
          browser_download_url: `https://${host}/${owner}/${project}/releases/download/${tagName}/${name}`
        }
      };
    }
  );
};
