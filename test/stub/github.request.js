const uuid = require('uuid/v4');
const releases = {};

module.exports = (request, options) => {
  const { url } = options;
  if (url === '/repos/:owner/:repo/releases' || url === '/repos/:owner/:repo/releases/:release_id') {
    const id = uuid();
    const { tag_name, name, body, prerelease, draft, owner, repo } = options;
    releases[id] = {
      id,
      tag_name,
      name,
      body,
      prerelease,
      draft,
      upload_url: `https://uploads.github.com/repos/${owner}/${repo}/releases/${id}/assets{?name,label}`,
      html_url: `https://github.com/${owner}/${repo}/releases/tag/${tag_name}`
    };
    return {
      data: releases[id],
      headers: {
        location: `https://api.github.com/repos/${owner}/${repo}/releases/${id}`
      }
    };
  } else if (url.startsWith('https://uploads.github.com/repos')) {
    const assetId = uuid();
    const { name } = options;
    const [, owner, repo, id] = url.match(/\/repos\/([^/]+)\/([^/]+)\/releases\/([^/]+).*/);
    const { tag_name } = releases[id];
    return {
      data: {
        id: assetId,
        url: `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`,
        name,
        label: '',
        state: 'uploaded',
        size: options.headers['content-length'],
        browser_download_url: `https://github.com/${owner}/${repo}/releases/download/${tag_name}/${name}`
      }
    };
  } else {
    return {};
  }
};
