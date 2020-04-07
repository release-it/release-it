# GitLab Releases

For this feature, at least GitLab v11.7 is required. GitLab 11.7 introduces
[Releases](https://docs.gitlab.com/ce/user/project/releases.html) to create release entries (much like GitHub),
including release assets. Releases are attached to an existing Git tag, so make sure the [Git part](./git.md) is
configured correctly.

[GitLab releases](https://docs.gitlab.com/ce/user/project/releases/) work just like GitHub releases:

- Configure `gitlab.release: true`.
- Obtain a [personal access token](https://gitlab.com/profile/personal_access_tokens) (release-it only needs the "api"
  scope).
- Make sure the token is [available as an environment variable](./environment-variables.md).

GitLab Releases do not support pre-releases or drafts.

## Release notes

By default, the output of `git.changelog` is used for the GitLab release notes. This is the printed `Changelog: ...`
when release-it boots. This can be overridden with the `gitlab.releaseNotes` option to customize the release notes for
the GitLab release. This script will run just before the actual GitLab release itself. Make sure it outputs to `stdout`.
An example:

```json
{
  "gitlab": {
    "release": true,
    "releaseNotes": "generate-release-notes.sh ${latestVersion} ${version}"
  }
}
```

See [Changelog](./changelog.md) for more information about generating changelogs/release notes.

## Attach binary assets

To upload binary release assets with a GitLab release (such as compiled executables, minified scripts, documentation),
provide one or more glob patterns for the `gitlab.assets` option. After the release, the assets are available to
download from the project's releases page. Example:

```json
{
  "gitlab": {
    "release": true,
    "assets": ["dist/*.dmg"]
  }
}
```

## Origin

The `origin` can be set to a string such as `"http://example.org:3000"` to use a different origin from what would be
derived from the Git url (e.g. to use `http` over the default `https://${repo.host}`).
