# GitHub Releases

<img align="right" src="./assets/github-release.png?raw=true" width="350" style="border:red;">

The "releases" page on GitHub projects links to a page containing the project's history, or changelog. Releases are
attached to an existing Git tag, so make sure the [Git part][1] is configured correctly.

Unsurprisingly, release-it uses this feature extensively ([release-it's releases page][2]).

See the screenshot on the right for an overview of what release-it automates.

To add [GitHub releases][3] in your release-it flow, there are two options:

1. Automated. This requires a personal access token.
2. Manual. The GitHub web interface will be opened with pre-populated fields.

## Configuration options

| Option                   | Description                                                                     |
| :----------------------- | :------------------------------------------------------------------------------ |
| `github.release`         | Set to `false` to skip the GitHub publish step                                  |
| `github.releaseName`     | Set the release name (default: `Release ${version}`)                            |
| `github.releaseNotes`    | Override the release notes with custom notes                                    |
| `github.autoGenerate`    | Let GitHub generate release notes (overrides other notes!)                      |
| `github.preRelease`      | Set the release to a pre-release status                                         |
| `github.draft`           | Set the release to a draft status                                               |
| `github.tokenRef`        | GitHub token environment variable name (default: `GITHUB_TOKEN`)                |
| `github.assets`          | Glob pattern path to assets to add to the GitHub release                        |
| `github.host`            | Use a different host from what would be derived from the Git URL                |
| `github.timeout`         | Timeout duration to wait for a response from the GitHub API                     |
| `github.proxy`           | If the release is performed behind a proxy, set this to string of the proxy URL |
| `github.skipChecks`      | Skip checks on `GITHUB_TOKEN` environment variable and user permissions         |
| `github.web`             | Explicitly override checking if the `GITHUB_TOKEN` is set                       |
| `github.comments.submit` | Submit a comment to each merged PR and closed issue part of the release         |
| `github.comments.issue`  | The text to add to the associated closed issues                                 |
| `github.comments.pr`     | The text to add to the associated merged pull requests                          |

## Automated

To automate the release (using the GitHub REST API), the following needs to be configured:

- Configure `github.release: true`
- Obtain a [personal access token][4] (release-it only needs "repo" access; no "admin" or other scopes).
- Make sure the token is [available as an environment variable][5].

Do not put the actual token in the release-it configuration. It will be read from the `GITHUB_TOKEN` environment
variable. You can change this variable name by setting the `github.tokenRef` option to something else.

Optionally, release-it can automatically [submit comments][6] to the merged pull requests and closed tickets to notify
people in which release the fix or feature is included.

## Manual

In this mode, release-it will open the default browser pointed at the GitHub web interface with the fields pre-populated
(like the screenshot above). The data can be modified and assets can be uploaded before publishing the release.

- Configure `github.release: true`
- This mode is enabled automatically when the `GITHUB_TOKEN` environment variable is not set.
- Set `github.web: true` explicitly to override this `GITHUB_TOKEN` check.
- Use `github.autoGenerate: true` to let GitHub generate release notes.

In non-interactive CI mode (using `--ci` or in a CI environment), release-it will not open a browser, but instead print
the url to the GitHub web interface (including data to pre-populate the fields).

## Git

A GitHub release requires the corresponding Git tag to be present on the remote (release-it creates and pushes this tag
automatically). Thus, in addition to the `GITHUB_TOKEN`, a public SSH key is required to push the Git tag to the remote
repository. See [Git remotes][7] (and [CI: Git][8]) for more information.

## Prerequisite checks

First, release-it will check whether the `GITHUB_TOKEN` environment variable is set. If not, it will fall back to [open
the web interface][9] to publish a release (and skip the next checks). If the token is set, it will authenticate, and
verify whether the current user is a collaborator and authorized to publish a release.

To skip these checks, use `github.skipChecks`.

## Release name

The default release name is `Release ${version}`. However, many projects are more creative here. It can be set from the
command-line directly: `--github.releaseName="Arcade Silver"`.

## Release notes

By default, the output of `git.changelog` is used for the GitHub release notes. This is the printed `Changelog: ...`
when release-it boots. This can be overridden with the `github.releaseNotes` option to customize the release notes for
the GitHub release. This will be invoked just before the actual GitHub release itself.

The value can either be a string or a function but a function is only supported when configuring release-it using
`.release-it.js` or `.release-it.cjs` file.

When the value is a string, it's executed as a shell script. Make sure it outputs to `stdout`. An example:

```json
{
  "github": {
    "release": true,
    "releaseNotes": "generate-release-notes.sh --from=${latestTag} --to=${tagName}"
  }
}
```

Another example using `--no-merges` to omit merge commits:

```json
{
  "github": {
    "release": true,
    "releaseNotes": "git log --no-merges --pretty=format:\"* %s %h\" ${latestTag}...main"
  }
}
```

### Function

When the value is a function, it's executed with a single `context` parameter that contains the plugin context. The
function can also be `async`. Make sure that it returns a string value. An example:

```js
{
  github: {
    release: true,
    releaseNotes(context) {
      // Remove the first, redundant line with version and date.
      return context.changelog.split('\n').slice(1).join('\n');
    }
  }
}
```

Use `--github.autoGenerate` to have GitHub auto-generate the release notes (does not work with `web: true`).

See [Changelog][10] for more information about generating changelogs/release notes.

### Object

Use an object to switch from the `releaseNotes` as a command string to commits fetched by the GitHub Octokit API and
rendered using the provided template. Example:

```json
{
  "github": {
    "releaseNotes": {
      "commit": "* ${commit.subject} (${sha}){ - thanks @${author.login}!}",
      "excludeMatches": ["webpro"]
    }
  }
}
```

Placeholders have syntax `${place.holder}`. Blocks surrounded by `{` and `}` are rendered only if each placeholder
inside is replaced with a value and that value is not in `excludeMatches`.

Here's an excerpt of an example object that is the context of the `releaseNotes.commit` template:

```json
{
  "sha": "2e8c8ac65fa9e05fc170d08913d7fbac2b2bd876",
  "commit": {
    "author": { "name": "Lars Kappert", "email": "lars@webpro.nl", "date": "2025-01-06T21:15:33Z" },
    "committer": { "name": "Lars Kappert", "email": "lars@webpro.nl", "date": "2025-01-06T21:15:33Z" },
    "message": "Add platform-specific entries to metro plugin",
    "url": "https://api.github.com/repos/webpro-nl/knip/git/commits/2e8c8ac65fa9e05fc170d08913d7fbac2b2bd876",
    "comment_count": 0,
    "verification": { "verified": false, "reason": "unsigned", "signature": null, "payload": null, "verified_at": null }
  },
  "url": "https://api.github.com/repos/webpro-nl/knip/commits/2e8c8ac65fa9e05fc170d08913d7fbac2b2bd876",
  "html_url": "https://github.com/webpro-nl/knip/commit/2e8c8ac65fa9e05fc170d08913d7fbac2b2bd876",
  "comments_url": "https://api.github.com/repos/webpro-nl/knip/commits/2e8c8ac65fa9e05fc170d08913d7fbac2b2bd876/comments",
  "author": { "login": "webpro", "id": 456426, "html_url": "https://github.com/webpro" },
  "committer": { "login": "webpro", "id": 456426, "avatar_url": "https://avatars.githubusercontent.com/u/456426?v=4" },
  "parents": []
}
```

The GitHub plugin adds `commit.subject` which is only the first line of `commit.message` (which is potentially multiple
lines especially for merge commits).

See
[REST API: Compare two commits](https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#compare-two-commits)
for the full specs of this object.

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

By default, the GitHub API host is [https://api.github.com][11]. Setting `github.host` to `"private.example.org"` would
result in release-it using [https://private.example.org/api/v3][12].

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

## Project Non-Latest Release

To do a release that isn't the latest release on your GitHub project e.g for support releases, you can set
`github.makeLatest` to `false`.

## Create GitHub Discussion

To auto-create GitHub Discussion for the release on your GitHub project, you can set:

`github.discussionCategoryName` to `[discussion category name]`

## Comments

To submit a comment to each merged pull requests and closed issue that is part of the release, set
`github.comments.submit` to `true`. Here are the default settings:

```json
{
  "github": {
    "comments": {
      "submit": false,
      "issue": ":rocket: _This issue has been resolved in v${version}. See [${releaseName}](${releaseUrl}) for release notes._",
      "pr": ":rocket: _This pull request is included in v${version}. See [${releaseName}](${releaseUrl}) for release notes._"
    }
  }
}
```

Example comment:

:rocket: _This issue has been resolved in v15.10.0. See [Release 15.10.0][13] for release notes._

This only works with `github.release: true` and not with [manual release via the web interface][9].

Since this is an experimental feature, it's disabled by default for now. Set `github.comments: true` to enable.

[1]: ./git.md
[2]: https://github.com/release-it/release-it/releases
[3]: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
[4]: https://github.com/settings/tokens/new?scopes=repo&description=release-it
[5]: ./environment-variables.md
[6]: #comments
[7]: ./git.md#git-remotes
[8]: ./ci.md#git
[9]: #manual
[10]: ./changelog.md
[11]: https://api.github.com
[12]: https://private.example.org/api/v3
[13]: https://github.com/release-it/release-it/releases/tag/15.10.0
