# Release It! 🚀

CLI release tool for Git repos and npm packages.

**Release It!** automates the tedious tasks of software releases:

<img align="right" src="./assets/release-it.gif?raw=true" height="170">

- Execute test & build commands
- Bump version (in e.g. `package.json`)
- Git commit, tag, push
- [Create release at GitHub](#github-releases) (and [upload assets](#release-assets))
- [Create release at GitLab](#gitlab-releases) (and [upload assets](#release-assets))
- [Generate changelog](#changelogs)
- [Publish to npm](#publish-to-npm)
- [Manage pre-releases](#manage-pre-releases)
- [Script Hooks](#scripts)
- Extend with [plugins](#plugins)

[![Build Status](https://travis-ci.org/release-it/release-it.svg?branch=master)](https://travis-ci.org/release-it/release-it)
[![npm version](https://badge.fury.io/js/release-it.svg)](https://badge.fury.io/js/release-it)
[![codecov](https://codecov.io/gh/release-it/release-it/branch/master/graph/badge.svg)](https://codecov.io/gh/release-it/release-it)

## Links

- **NEW**: [release-it supports plugins](https://github.com/release-it/release-it/issues/501) (since v11), so virtually
  any functionality can be added to your release process.
- For **updates**, see [CHANGELOG.md](CHANGELOG.md) for major updates, and
  [releases](https://github.com/release-it/release-it/releases) for a detailed version history.
- To **contribute**, please read [CONTRIBUTING.md](CONTRIBUTING.md) first.
- Please [open an issue](https://github.com/release-it/release-it/issues/new) if anything is missing or unclear in this
  documentation.

<details>
  <summary><strong>Table of Contents</strong> (click to expand)</summary>

<!-- toc -->

- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Interactive vs. non-interactive mode](#interactive-vs-non-interactive-mode)
- [Latest version](#latest-version)
- [Git](#git)
- [GitHub Releases](#github-releases)
- [GitLab Releases](#gitlab-releases)
- [Changelogs](#changelogs)
- [Publish to npm](#publish-to-npm)
- [Manage pre-releases](#manage-pre-releases)
- [Scripts](#scripts)
- [Plugins](#plugins)
- [Distribution repository](#distribution-repository)
- [Metrics](#metrics)
- [Troubleshooting & debugging](#troubleshooting--debugging)
- [Use release-it programmatically](#use-release-it-programmatically)
- [Example projects using release-it](#example-projects-using-release-it)
- [Resources](#resources)
- [Credits](#credits)

<!-- tocstop -->

</details>

## Installation

### Global

As a globally available CLI command:

```bash
npm install --global release-it
```

### Local

As a `devDependency` in your project:

```
npm install --save-dev release-it
```

Add this as a `script` to `package.json`:

```json
{
  "name": "my-package",
  "version": "1.0.0",
  "scripts": {
    "release": "release-it"
  },
  "devDependencies": {
    "release-it": "*"
  }
}
```

Now you can run `npm run release` from the command line.

## Usage

Release a new version:

```bash
release-it
```

You will be prompted to select the new version. To skip the first prompt, provide a specific increment or version:

```bash
release-it minor
release-it 0.8.3
```

For a "dry run", to show the interactivity and the commands it _would_ execute:

```bash
release-it --dry-run
```

Note: read-only commands are still executed (`$ ...`), while the rest is not (`! ...`):

```
$ git rev-parse --git-dir
.git
! git add package.json
! git commit --message="Release 0.8.3"
```

## Configuration

Out of the box, release-it has sane defaults, and [plenty of options](conf/release-it.json) to configure it. Put the
options to override in `.release-it.json` in the project root. Example:

```json
{
  "git": {
    "tagName": "v${version}"
  },
  "github": {
    "release": true
  }
}
```

Or in a `release-it` property in `package.json`:

```json
{
  "name": "my-package",
  "devDependencies": {
    "release-it": "*"
  },
  "release-it": {
    "github": {
      "release": true
    }
  }
}
```

Notes:

- Only the settings to override need to be in `.release-it.json` (or `package.json`). Everything else will fall back to
  the [default configuration](conf/release-it.json).
- You can use `--config` if you want to use another path for `.release-it.json`.
- You can also use a regular JavaScript file, for example `.release-it.js`, as long as you point to it using `--config`.
  This can be useful if your configuration depends on something else, so you have all JavaScript power to use instead of
  a static JSON. Make sure you export the config with `module.exports`.

Any option can also be set on the command-line, and will have highest priority. Example:

```bash
release-it minor --git.tagName='v${version}' --github.release
```

Boolean arguments can be negated by using the `no-` prefix:

```bash
release-it --no-npm.publish
```

## Interactive vs. non-interactive mode

By default, release-it is **interactive** and allows you to confirm each task before execution:

<img src="./assets/release-it-interactive.gif?raw=true" height="290">

By using the `-n` option (i.e. **non-interactive**), the process is fully automated without prompts. The configured
tasks will be executed as demonstrated in the first animation above.

On a Continuous Integration (CI) environment, the non-interactive mode is activated automatically.

## Latest version

For projects with a `package.json`, its `version` will be used. Otherwise, release-it uses the latest Git tag to
determine which version should be released. In any case, as a last resort, `0.0.0` will be used as the latest version.

Use `--no-npm` (or `"npm": false`) to ignore and skip bumping `package.json` (and skip `npm publish`).

Alternatively, a plugin can be used to get the version from anywhere else. Also see [plugins](docs/plugins/README.md).

## Git

### SSH keys & Git remotes

SSH keys and Git remotes are assumed to be configured correctly. If a manual `git push` from the command line works,
release-it should be able to do the same.

The following help pages might be useful: [SSH](https://help.github.com/articles/connecting-to-github-with-ssh/) and
[Managing Remotes](https://help.github.com/categories/managing-remotes/) (GitHub),
[SSH keys](https://confluence.atlassian.com/bitbucket/ssh-keys-935365775.html) (Bitbucket),
[SSH keys](https://gitlab.com/help/ssh/README.md) (GitLab).

### Remote repository

By default, `release-it` uses `origin` as the remote name to push to. Use `git.pushRepo` to override this with a
different remote name (or a different git url).

### Extra arguments

In case extra arguments should be provided to Git, these options are available:

- `git.commitArgs`
- `git.tagArgs`
- `git.pushArgs`

For example, use `"git.commitArgs": "-S"` to sign commits (also see
[#35](https://github.com/release-it/release-it/issues/350)).

### Skip Git steps

To skip the Git steps (commit, tag, push) entirely (e.g. to only `npm publish`), use the shorthand:

```
release-it --no-git
```

Use e.g. `git.tag: false` or `--no-git.tag` to skip a single step.

### Untracked files

By default, untracked files are not added to the release commit. Use `git.addUntrackedFiles: true` to override this
behavior.

## GitHub Releases

The "Releases" tab on GitHub projects links to a page to store the changelog. To add
[GitHub releases](https://help.github.com/articles/creating-releases/) in your release-it flow:

- Configure `github.release: true`.
- Obtain a [personal access token](https://github.com/settings/tokens) (release-it only needs "repo" access; no "admin"
  or other scopes).
- Make sure the token is available as an environment variable. Example:

```bash
export GITHUB_TOKEN="f941e0..."
```

Do not put the actual token in the release-it configuration. It will be read from the `GITHUB_TOKEN` environment
variable. You can change this variable name by setting the `github.tokenRef` option to something else.

Obviously, release-it uses this feature extensively:
[release-it's releases page](https://github.com/release-it/release-it/releases).

### Release notes

By default, the output of `git.changelog` is used for the GitHub release notes. This is the printed `Changelog: ...`
when release-it boots. Override this with the `github.releaseNotes` option. This script will run just before the actual
GitHub release itself. Make sure it outputs to `stdout`. An example:

```
{
  "github": {
    "release": true,
    "releaseNotes": "generate-release-notes.sh ${latestVersion} ${version}"
  }
}
```

### Release assets

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

## GitLab Releases

[GitLab releases](https://docs.gitlab.com/ee/workflow/releases.html#releases) work just like GitHub releases:

- Configure `gitlab.release: true`.
- Obtain a [personal access token](https://gitlab.com/profile/personal_access_tokens) (release-it only needs the "api"
  scope).
- Make sure the token is available as an environment variable. Example:

```bash
export GITLAB_TOKEN="f941e0..."
```

The output of `git.changelog` (or `gitlab.releaseNotes` if set) will be attached to the latest tag.

GitLab 11.7 introduces [Releases](https://docs.gitlab.com/ce/user/project/releases.html) to create release entries (much
like GitHub), including release assets. For GitLab 11.6 and lower, release-it will automatically fall back to
[attach releases notes to a tag](https://docs.gitlab.com/ce/workflow/releases.html). In this case, assets will not get
included.

Uploading assets work just like [GitHub Release assets](#release-assets), e.g. `--gitlab.assets=*.dmg`.

## Changelogs

By default, release-it generates a changelog, to show and help select a version for the new release. Additionally, this
changelog serves as the release notes for the GitHub or GitLab release.

The [default command](conf/release-it.json) is based on `git log ...`. This setting (`git.changelog`) can be overridden.
To customize the release notes for the GitHub or GitLab release, use `github.releaseNotes` or `gitlab.releaseNotes`.
Make sure any of these commands output the changelog to `stdout`.

Instead of executing a shell command, a (Handlebars) template can be used to generate the changelog. See
[auto-changelog](#auto-changelog) below for more details.

Some projects keep their changelog in e.g. `CHANGELOG.md` or `history.md`. To auto-update this file with the release,
the recommended configuration is to use a command that does this in `scripts.beforeStage`. See below for examples and
workflows.

### Auto-changelog

A tool like [auto-changelog](https://github.com/CookPete/auto-changelog) is a great companion to release-it:

```json
{
  "git": {
    "changelog": "npx auto-changelog --stdout --commit-limit false -u --template ./changelog.hbs"
  },
  "scripts": {
    "beforeStage": "npx auto-changelog -p"
  }
}
```

With this `git.changelog`, the changelog preview is based on the `changelog.hbs` template file. This would be used for
[GitHub](#github-releases) or [GitLab releases](#gitlab-releases) as well.

Additionally, `scripts.beforeStage` will update the `CHANGELOG.md` with each release to get included with the release
commit. This can be omitted if the project does not keep a `CHANGELOG.md` or similar.

See the [auto-changelog recipe](docs/recipes/auto-changelog.md) for an example setup and template.

### Conventional Changelog

If your project follows conventions, such as the
[Angular commit guidelines](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits), the
`@release-it/conventional-changelog` plugin is useful.

```bash
npm install @release-it/conventional-changelog --save-dev
```

Use this plugin to get the recommended bump based on the commit messages, generate a conventional changelog, and update
the `CHANGELOG.md` file:

```json
{
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "angular",
      "infile": "CHANGELOG.md"
    }
  }
}
```

- Omit the `infile` at will. If set, but the file does not exist yet, it's created with the full history.
- Please find the
  [list of available presets](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages)
  (`angular`, `ember`, etc).
- The options are sent verbatim to
  [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog/README.md).

## Publish to npm

With a `package.json` in the current directory, release-it will let `npm` bump the version in `package.json` (and
`package-lock.json` if present), and publish to the npm registry.

### Public scoped packages

A [scoped package](https://docs.npmjs.com/misc/plugin) (e.g. `@user/package`) is either public or private. To
[publish scoped packages](https://docs.npmjs.com/misc/plugin#publishing-scoped-packages), make sure this is in
`package.json`:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

By default, `npm publish` will
[publish a scoped package as private](https://docs.npmjs.com/creating-and-publishing-private-packages) (requires paid
account).

### Two-factor authentication

In case two-factor authentication (2FA) is enabled for the package, release-it will ask for the one-time password (OTP).

The OTP can be provided from the command line (`--npm.otp=123456`). However, providing the OTP without a prompt
basically defeats the purpose of 2FA (also, the OTP expires after a short period).

### Monorepos

Monorepos do not require extra configuration, but release-it handles only one package at a time. Also see how
[Git steps can be skipped](#skip-git-steps) (e.g. if tagging the Git repo should be skipped).

### Misc.

- The `"private": true` setting in package.json will be respected, and `release-it` will skip this step.
- Getting an `ENEEDAUTH` error while a manual `npm publish` works? Please see
  [#95](https://github.com/release-it/release-it/issues/95#issuecomment-344919384).

## Manage pre-releases

With release-it, it's easy to create pre-releases: a version of your software that you want to make available, while
it's not in the stable semver range yet. Often "alpha", "beta", and "rc" (release candidate) are used as identifier for
pre-releases.

An example. The `awesome-pkg` is at version 1.3.0, and work is done for a new major update. To publish the latest beta
of the new major version:

```
release-it major --preRelease=beta
```

This will tag and release version `2.0.0-beta.0`. Notes:

- A normal installation of `awesome-pkg` will still be at version 1.3.0.
- The [npm tag](https://docs.npmjs.com/cli/dist-tag) will be "beta", install it using `npm install awesome-pkg@beta`
- A GitHub release will be marked as a "Pre-release".

The above command is actually a shortcut for:

```
release-it premajor --preReleaseId=beta --npm.tag=beta --github.preRelease
```

Consecutive beta releases (`2.0.0-beta.1` and so on):

```
release-it --preRelease
```

And when ready to release the next phase (e.g. release candidate, in this case `2.0.0-rc.0`):

```
release-it --preRelease=rc
```

And eventually, for `2.0.0`:

```
release-it major
```

<img src="./assets/release-it-prerelease.gif?raw=true" height="524">

Notes:

- Pre-releases work in tandem with [recommended bumps](#recommended-bump).
- You can still override individual options, e.g. `release-it --preRelease=rc --npm.tag=next`.
- See [semver.org](http://semver.org) for more details about semantic versioning.

## Scripts

These script hooks can be used to execute commands (from the root directory of the repository):

- `scripts.beforeStart`
- `scripts.beforeBump`
- `scripts.afterBump`
- `scripts.beforeStage`
- `scripts.afterRelease`

All commands can use configuration variables (like template strings). An array of commands can also be provided, they
will run one after another. Some examples:

```json
{
  "scripts": {
    "beforeStart": ["npm run lint", "npm test"],
    "afterBump": "tar -czvf foo-${version}.tar.gz",
    "afterRelease": "echo Successfully released ${name} v${version} to ${repo.repository}."
  }
}
```

The variables can be found in the [default configuration](conf/release-it.json). Additionally, the following variables
are exposed:

```
version
latestVersion
changelog
name
repo.remote, repo.protocol, repo.host, repo.owner, repo.repository, repo.project
```

## Plugins

Since v11, release-it can be extended in many, many ways. Please head over to [plugins](docs/plugins/README.md) for more
details.

## Distribution repository

Some projects use a distribution repository. Generated files (such as compiled assets or documentation) can be
distributed to a separate repository. Or to a separate branch, such as a `gh-pages`. Some examples include
[shim repositories](https://github.com/components) and a separate
[packaged Angular.js repository](https://github.com/angular/bower-angular) for distribution on npm and Bower.

The `dist.repo` option was removed in v10, but similar setups can still be achieved. Please see the
[distribution repository](docs/recipes/distribution-repo.md) recipe for example configurations.

## Metrics

Use `--disable-metrics` to opt-out of sending some anonymous statistical data to Google Analytics. For details, refer to
[lib/metrics.js](lib/metrics.js). Please consider to not opt-out: more data means more support for future development.

## Troubleshooting & debugging

- With `release-it --verbose`, release-it prints every command and its output.
- Prepend `DEBUG=release-it:* release-it [...]` to print configuration and more error details.
- Use `DEBUG=* release-it [...]` to include debug output for dependencies, such as
  [@octokit/rest](https://github.com/octokit/rest.js).

## Use release-it programmatically

While mostly used as a CLI tool, release-it can be used as a dependency to ingrate in your own scripts. See
[use release-it programmatically](docs/recipes/programmatic.md) for example code.

## Example projects using release-it

- [react-navigation/react-navigation](https://github.com/react-navigation/react-navigation)
- [swagger-api/swagger-ui](https://github.com/swagger-api/swagger-ui)
- [StevenBlack/hosts](https://github.com/StevenBlack/hosts)
- [react-native-community/react-native-tab-view](https://github.com/react-native-community/react-native-tab-view)
- [callstack/linaria](https://github.com/callstack/linaria)
- [blockchain/blockchain-wallet-v4-frontend](https://github.com/blockchain/blockchain-wallet-v4-frontend)
- [infor-design/enterprise](https://github.com/infor-design/enterprise)
- [tsqllint/tsqllint](https://github.com/tsqllint/tsqllint)
- [segmentio/typewriter](https://github.com/segmentio/typewriter)
- [Repositories that depend on release-it](https://github.com/release-it/release-it/network/dependents)
- GitHub search for
  [projects with .release-it.json](https://github.com/search?o=desc&q=in%3Apath+.release-it.json&s=indexed&type=Code)

## Resources

- [semver.org](http://semver.org)
- [GitHub Help](https://help.github.com) (→ [About Releases](https://help.github.com/articles/about-releases/))
- [npm Blog: Publishing what you mean to publish](https://blog.npmjs.org/post/165769683050/publishing-what-you-mean-to-publish)
- [npm Documentation: package.json](https://docs.npmjs.com/files/package.json)
- [Prereleases and npm](https://medium.com/@mbostock/prereleases-and-npm-e778fc5e2420)
- [Glob Primer (node-glob)](https://github.com/isaacs/node-glob#glob-primer) (release-it uses
  [globby](https://github.com/sindresorhus/globby#readme))

## Credits

Major dependencies:

- [ShellJS](https://documentup.com/shelljs/shelljs)
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)
- [@octokit/rest](https://github.com/octokit/rest.js)

The following Grunt plugins have been a source of inspiration:

- [grunt-release](https://github.com/geddski/grunt-release)
- [grunt-release-component](https://github.com/walmartlabs/grunt-release-component)
