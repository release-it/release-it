# GitHub Releases

The "Releases" tab on GitHub projects links to a page to store the changelog. Releases are attached to an existing Git
tag, so make sure the [Git part](./git.md) is configured correctly.

Unsurprisingly, release-it uses this feature extensively:
[release-it's releases page](https://github.com/release-it/release-it/releases).

See this screenshot for an overview of what release-it automates:

<img src="./assets/github-release.png?raw=true" width="662" style="border:red;">

To add [GitHub releases](https://help.github.com/articles/creating-releases/) in your release-it flow:

- Configure `github.release: true`.
- Obtain a [personal access token](https://github.com/settings/tokens) (release-it only needs "repo" access; no "admin"
  or other scopes).
- Make sure the token is available as an environment variable. Example:

```bash
export GITHUB_TOKEN="f941e0..."
```

Do not put the actual token in the release-it configuration. It will be read from the `GITHUB_TOKEN` environment
variable. You can change this variable name by setting the `github.tokenRef` option to something else.

## Release name

The default release name is `Release ${version}`. However, many projects are more creative here. It can be set from the
command-line directly: `--github.releaseName="Arcade Silver"`.

## Release notes

By default, the output of `git.changelog` is used for the GitHub release notes. This is the printed `Changelog: ...`
when release-it boots. This can be overridden with the `github.releaseNotes` option to customize the release notes for
the GitHub release. This script will run just before the actual GitHub release itself. Make sure it outputs to `stdout`.
An example:

```
{
  "github": {
    "release": true,
    "releaseNotes": "generate-release-notes.sh ${latestVersion} ${version}"
  }
}
```

See [Changelog](./changelog) for more information about generating changelogs/release notes.

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

## Proxy

In case release are done from behind a proxy, set `github.proxy` using a string to a proxy address like
`"http://proxy:8080"`.
