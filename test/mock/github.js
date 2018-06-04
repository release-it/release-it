module.exports = class GitHubApi {
  get repos() {
    return {
      createRelease: (opts, cb) => {
        cb(null, releaseResponse);
      },
      uploadAsset: (opts, cb) => {
        cb(null, uploadResponse);
      }
    };
  }

  authenticate() {}
};

const releaseResponse = {
  data: {
    url: 'https://api.github.com/repos/webpro/release-it-test/releases/7933755',
    assets_url: 'https://api.github.com/repos/webpro/release-it-test/releases/7933755/assets',
    upload_url: 'https://uploads.github.com/repos/webpro/release-it-test/releases/7933755/assets{?name,label}',
    html_url: 'https://github.com/webpro/release-it-test/releases/tag/v2.0.1',
    id: 7933755,
    tag_name: 'v2.0.1',
    target_commitish: 'master',
    name: 'Release 2.0.1',
    draft: false,
    author: {
      login: 'webpro',
      id: 456426,
      avatar_url: 'https://avatars1.githubusercontent.com/u/456426?v=4',
      gravatar_id: '',
      url: 'https://api.github.com/users/webpro',
      html_url: 'https://github.com/webpro',
      followers_url: 'https://api.github.com/users/webpro/followers',
      following_url: 'https://api.github.com/users/webpro/following{/other_user}',
      gists_url: 'https://api.github.com/users/webpro/gists{/gist_id}',
      starred_url: 'https://api.github.com/users/webpro/starred{/owner}{/repo}',
      subscriptions_url: 'https://api.github.com/users/webpro/subscriptions',
      organizations_url: 'https://api.github.com/users/webpro/orgs',
      repos_url: 'https://api.github.com/users/webpro/repos',
      events_url: 'https://api.github.com/users/webpro/events{/privacy}',
      received_events_url: 'https://api.github.com/users/webpro/received_events',
      type: 'User',
      site_admin: false
    },
    prerelease: false,
    created_at: '2017-09-28T21:54:32Z',
    published_at: '2017-09-28T21:54:35Z',
    assets: [],
    tarball_url: 'https://api.github.com/repos/webpro/release-it-test/tarball/v2.0.1',
    zipball_url: 'https://api.github.com/repos/webpro/release-it-test/zipball/v2.0.1',
    body: ''
  },
  headers: {
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': '4992',
    'x-ratelimit-reset': '1506638741',
    'x-oauth-scopes': 'repo',
    'x-github-request-id': 'DF59:0D61:AEF19A:1EBEDF0:59CD6F9A',
    'x-github-media-type': 'github.v3; format=json',
    location: 'https://api.github.com/repos/webpro/release-it-test/releases/7933755',
    etag: '"9d2d1aa271002befea7f6c682e0e3678"',
    status: '201 Created'
  }
};

const uploadResponse = {
  data: {
    url: 'https://api.github.com/repos/webpro/release-it-test/releases/assets/4939790',
    id: 4939790,
    name: 'file1',
    label: '',
    uploader: {
      login: 'webpro',
      id: 456426,
      avatar_url: 'https://avatars1.githubusercontent.com/u/456426?v=4',
      gravatar_id: '',
      url: 'https://api.github.com/users/webpro',
      html_url: 'https://github.com/webpro',
      followers_url: 'https://api.github.com/users/webpro/followers',
      following_url: 'https://api.github.com/users/webpro/following{/other_user}',
      gists_url: 'https://api.github.com/users/webpro/gists{/gist_id}',
      starred_url: 'https://api.github.com/users/webpro/starred{/owner}{/repo}',
      subscriptions_url: 'https://api.github.com/users/webpro/subscriptions',
      organizations_url: 'https://api.github.com/users/webpro/orgs',
      repos_url: 'https://api.github.com/users/webpro/repos',
      events_url: 'https://api.github.com/users/webpro/events{/privacy}',
      received_events_url: 'https://api.github.com/users/webpro/received_events',
      type: 'User',
      site_admin: false
    },
    content_type: 'application/octet-stream',
    state: 'uploaded',
    size: 5,
    download_count: 0,
    created_at: '2017-09-28T21:54:35Z',
    updated_at: '2017-09-28T21:54:35Z',
    browser_download_url: 'https://github.com/webpro/release-it-test/releases/download/v2.0.1/file1'
  },
  headers: {
    'x-oauth-scopes': 'repo',
    'x-github-request-id': 'DF5A:75EB:17448CD:18B3107:59CD6F9B',
    'x-github-media-type': 'github.v3; format=json',
    'last-modified': 'Thu, 28 Sep 2017 21:54:35 GMT',
    etag: 'W/"63a607b90cfa49d82f88ae7e6dbee08b"'
  }
};
