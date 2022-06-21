# GitHub Releases

<img align="right" src="./assets/github-release.png?raw=true" width="350" style="border:red;">

The "releases" page on GitHub projects links to a page containing the project's history, or changelog. Releases are
attached to an existing Git tag, so make sure the [Git part](./git.md) is configured correctly.

Unsurprisingly, release-it uses this feature extensively
([release-it's releases page](https://github.com/release-it/release-it/releases)).

See the screenshot on the right for an overview of what release-it automates.

To add [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) in your
release-it flow, there are two options:

1. Automated. This requires a personal access token.
2. Manual. The GitHub web interface will be opened with pre-populated fields.

## Automated

To automate the release (using the GitHub REST API), the following needs to be configured:

- Configure `github.release: true`
- Obtain a [personal access token](https://github.com/settings/tokens/new?scopes=repo&description=release-it)
  (release-it only needs "repo" access; no "admin" or other scopes).
- Make sure the token is [available as an environment variable](./environment-variables.md).

Do not put the actual token in the release-it configuration. It will be read from the `GITHUB_TOKEN` environment
variable. You can change this variable name by setting the `github.tokenRef` option to something else.

## Manual

In this mode, release-it will open the default browser pointed at the GitHub web interface with the fields pre-populated
(like the screenshot above). The data can be modified and assets can be uploaded before publishing the release.

- Configure `github.release: true`
- This mode is enabled automatically when the `GITHUB_TOKEN` environment variable is not set.
- Set `github.web: true` explicitly to override this `GITHUB_TOKEN` check.

In non-interactive CI mode (using `--ci` or in a CI environment), release-it will not open a browser, but instead print
the url to the GitHub web interface (including data to pre-populate the fields).

## Git

A GitHub release requires the corresponding Git tag to be present on the remote (release-it creates and pushes this tag
automatically). Thus, in addition to the `GITHUB_TOKEN`, a public SSH key is required to push the Git tag to the remote
repository. See [Git remotes](./git.md#git-remotes) (and [CI: Git](./ci.md#git)) for more information.

## Prerequisite checks

First, release-it will check whether the `GITHUB_TOKEN` environment variable is set. If not, it will fall back to
[open the web interface](#manual) to publish a release (and skip the next checks). If the token is set, it will
authenticate, and verify whether the current user is a collaborator and authorized to publish a release.

To skip these checks, use `github.skipChecks`.

## Release name

The default release name is `Release ${version}`. However, many projects are more creative here. It can be set from the
command-line directly: `--github.releaseName="Arcade Silver"`.

## Release notes

By default, the output of `git.changelog` is used for the GitHub release notes. This is the printed `Changelog: ...`
when release-it boots. This can be overridden with the `github.releaseNotes` option to customize the release notes for
the GitHub release. This script will run just before the actual GitHub release itself. Make sure it outputs to `stdout`.
An example:

```json
{
  "github": {
    "release": true,
    "releaseNotes": "generate-release-notes.sh --from=${latestTag} --to=${tagName}"
  }
}
```

Use `--github.autoGenerate` to have GitHub auto-generate the release notes.

See [Changelog](./changelog.md) for more information about generating changelogs/release notes.

## Attach binary assets

To upload binary release assets with a GitHub release (such as compiled executables, minified scripts, documentation),
provide one or more glob patterns for the `github.assets` option. After the release, the assets are available to
download from the GitHub release page. Example:

```json
{
  "github": {
    "release": true,
    "assets": ["dist/*.zip"]
  }
}
```

## Pre-release

If the release is a pre-release (according to semver), release-it automatically sets `github.preRelease` to `true`. This
can also be set manually.

## Draft

In case the release should not be made public yet, set `github.draft: true`.

## Host

Use a different host from what would be derived from the Git url (e.g. when using GitHub Enterprise).

By default, the GitHub API host is https://api.github.com. Setting `github.host` to `"private.example.org"` would result
in release-it using https://private.example.org/api/v3.

## Proxy

In case release are done from behind a proxy, set `github.proxy` using a string to a proxy address like
`"http://proxy:8080"`.

## Update the latest release

The latest GitHub release can be updated, e.g. to update the releases notes, add release assets, or toggle the `draft`
status.

- Use `--no-increment` to skip updating the version.
- Use `--no-git` to skip Git commit, tag, push (when the tag is already there).
- Use `--no-npm` to skip publishing to npm (if there's a `package.json`).
- Use `--github.update` to update the GitHub release.

Use the other options to update the release, such as `--github.assets` to add assets. Note that the `draft` and
`preRelease` options are `false` by default, but can be set explicitly using e.g. `--no-github.draft` or
`--github.draft`.

Example command to add assets and explicitly toggle the draft status to "published":

```bash
release-it --no-increment --no-git --github.release --github.update --github.assets=*.zip --no-github.draft
```
