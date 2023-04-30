# GitLab Releases

For this feature, at least GitLab v11.7 is required. GitLab 11.7 introduces [Releases][1] to create release entries
(much like GitHub), including release assets. Releases are attached to an existing Git tag, so make sure the [Git
part][2] is configured correctly.

[GitLab releases][1] work just like GitHub releases:

- Configure `gitlab.release: true`.
- Obtain a [personal access token][3] (release-it only needs the "api" scope).
- Make sure the token is [available as an environment variable][4].

GitLab Releases do not support pre-releases or drafts.

## Prerequisite checks

First, release-it will check whether the `GITLAB_TOKEN` environment variable is set. Otherwise it will throw an error
and exit. Then, it will authenticate, and verify whether the current user is a collaborator and authorized to publish a
release.

To skip these checks, use `gitlab.skipChecks`.

## Release notes

By default, the output of `git.changelog` is used for the GitLab release notes. This is the printed `Changelog: ...`
when release-it boots. This can be overridden with the `gitlab.releaseNotes` option to customize the release notes for
the GitLab release. This will be invoked just before the actual GitLab release itself.

The value can either be a string or a function but a function is only supported when configuring release-it using
`.release-it.js` or `.release-it.cjs` file.

When the value is a string, it's executed as a shell script. Make sure it outputs to `stdout`. An example:

```json
{
  "gitlab": {
    "release": true,
    "releaseNotes": "generate-release-notes.sh ${latestVersion} ${version}"
  }
}
```

When the value is a function, it's executed with a single `context` parameter that contains the plugin context. The
function can also be `async`. Make sure that it returns a string value. An example:

```js
{
  gitlab: {
    release: true,
    releaseNotes(context) {
      // Remove the first, redundant line with version and date.
      return context.changelog.split('\n').slice(1).join('\n');
    }
  }
}
```

See [Changelog][5] for more information about generating changelogs/release notes.

## Milestones

To associate one or more milestones with a GitLab release, set the `gitlab.milestones` option to an array of the titles
of the corresponding milestones, for example:

```json
{
  "gitlab": {
    "release": true,
    "milestones": ["${version}"]
  }
}
```

Note that creating a GitLab release will fail if one of the given milestones does not exist. release-it will check this
before doing the release. To skip this check, use `gitlab.skipChecks`.

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

## Private CA Authority

If you're running your own GitLab instance with an HTTPS certificate issued by a private certificate Authority, you can
specify the root CA certificate with `certificateAuthorityFile`, for example:

```json
{
  "gitlab": {
    "release": true,
    "tokenHeader": "PRIVATE-TOKEN",
    "certificateAuthorityFile": "./my-root-ca.crt"
  }
}
```

## Update the latest release

The latest GitLab release can be updated, e.g. to update the releases notes or add release assets.

- Use `--no-increment` to skip updating the version.
- Use `--no-git` to skip Git actions.
- Use `--no-npm` to skip publishing to npm if there's a `package.json`.

Use the other options to update the release, such as `--gitlab.assets` to add assets.

Example command to add assets to the latest release:

```bash
release-it --no-increment --no-git --gitlab.release --gitlab.assets=*.zip
```

[1]: https://docs.gitlab.com/ce/user/project/releases/
[2]: ./git.md
[3]: https://gitlab.com/profile/personal_access_tokens
[4]: ./environment-variables.md
[5]: ./changelog.md
