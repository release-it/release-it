# Release It! 🚀

CLI release tool for Git repos and npm packages.

**Release It!** automates the tedious tasks of software releases:

<img align="right" src="./assets/release-it.gif?raw=true" height="280">

- Execute test & build commands
- Bump version (in e.g. `package.json`)
- Git commit, tag, push
- [Create release at GitHub](#github-releases)
- [Create release at GitLab](#gitlab-releases)
- [Generate changelog](#changelog)
- [Publish to npm](#publish-to-npm)
- [Manage pre-releases](#manage-pre-releases)
- [Hooks](#hooks)
- Extend with [plugins](#plugins)
- Release from any [CI/CD environment](./docs/ci.md)

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
- [Interactive vs. CI mode](#interactive-vs-ci-mode)
- [Latest version](#latest-version)
- [Prerequisite checks](#prerequisite-checks)
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

Although release-it is a **generic** release tool, installation requires npm. A `package.json` file is not required. The
recommended way to install release-it also adds basic configuration. Answer one or two questions and it's ready:

```bash
npm init release-it
```

Alternatively, install it manually, and add the `release` script to `package.json`:

```bash
npm install --save-dev release-it
```

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

Now you can run `npm run release` from the command line (any release-it arguments behind the `--`):

```
npm run release
npm run release -- minor --ci
```

### Global usage

Use release-it in any (non-npm) project, take it for a test drive, or install it globally:

```bash
# Run release-it from anywhere (without installation)
npx release-it

# Install globally and run from anywhere
npm install --global release-it
release-it
```

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

Out of the box, release-it has sane defaults, and [plenty of options](conf/release-it.json) to configure it. Put (only)
the options to override in a configuration file. This is where release-it looks for configuration:

- `.release-it.json`
- `.release-it.js` (export the configuration object: `module.exports = {}`)
- `.release-it.yaml` (or `.yml`)
- `.release-it.toml`
- `package.json` (in the `release-it` property)

Use `--config` to use another path for the configuration file. An example `.release-it.json`:

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

Or use YAML in `.release-it.yml`:

```
git:
  commitMessage: 'chore: release v${version}'
```

Or TOML in `.release-it.toml`:

```
[hooks]
before:init = "npm test"
```

Any option can also be set on the command-line, and will have highest priority. Example:

```bash
release-it minor --git.tagName='v${version}' --github.release
```

Boolean arguments can be negated by using the `no-` prefix:

```bash
release-it --no-npm.publish
```

## Interactive vs. CI mode

By default, release-it is **interactive** and allows you to confirm each task before execution:

<img src="./assets/release-it-interactive.gif?raw=true" height="290">

By using the `--ci` option, the process is fully automated without prompts. The configured tasks will be executed as
demonstrated in the first animation above. On a Continuous Integration (CI) environment, this non-interactive mode is
activated automatically.

Note: the old `-n` (or `--non-interactive`) option still works and is identical to `--ci`.

## Latest version

For projects with a `package.json`, its `version` will be used. Otherwise, release-it uses the latest Git tag to
determine which version should be released. In any case, as a last resort, `0.0.0` will be used as the latest version.

Use `--no-npm` (or `"npm": false`) to ignore and skip bumping `package.json` (and skip `npm publish`).

Alternatively, a plugin can be used to get the version from anywhere else. Also see [plugins](./docs/plugins/README.md).

## Prerequisite checks

Read more about [prerequisites checks](./docs/prerequisites.md) release-it does to help prevent incorrect or polluted
releases.

## Git

### SSH keys & Git remotes

SSH keys and Git remotes are assumed to be configured correctly. If a manual `git push` from the command line works,
release-it should be able to do the same.

The following help pages might be useful: [SSH](https://help.github.com/articles/connecting-to-github-with-ssh/) and
[Managing Remotes](https://help.github.com/categories/managing-remotes/) (GitHub),
[SSH keys](https://confluence.atlassian.com/bitbucket/ssh-keys-935365775.html) (Bitbucket),
[SSH keys](https://gitlab.com/help/ssh/README.md) (GitLab).

### Remote repository

By default, `release-it` uses `"origin"` as the remote name to push to. Use `git.pushRepo` to override this with a
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

The "Releases" tab on GitHub projects links to a page to store the changelog cq. release notes. To add
[GitHub releases](https://help.github.com/articles/creating-releases/) in your release-it flow:

- Configure `github.release: true`.
- Obtain a [personal access token](https://github.com/settings/tokens) (release-it only needs "repo" access; no "admin"
  or other scopes).
- Make sure the token is available as an environment variable. Example:

```bash
export GITHUB_TOKEN="f941e0..."
```

→ See [GitHub Releases](./docs/github-releases.md) for more details.

## GitLab Releases

[GitLab releases](https://docs.gitlab.com/ee/workflow/releases.html#releases) work just like GitHub releases:

- Configure `gitlab.release: true`.
- Obtain a [personal access token](https://gitlab.com/profile/personal_access_tokens) (release-it only needs the "api"
  scope).
- Make sure the token is available as an environment variable. Example:

```bash
export GITLAB_TOKEN="f941e0..."
```

→ See [GitLab Releases](./docs/gitlab-releases.md) for more details.

## Changelog

By default, release-it generates a changelog, to show and help select a version for the new release. Additionally, this
changelog serves as the release notes for the GitHub or GitLab release.

The [default command](conf/release-it.json) is based on `git log ...`. This setting (`git.changelog`) can be overridden.
To customize the release notes for the GitHub or GitLab release, use `github.releaseNotes` or `gitlab.releaseNotes`.
Make sure any of these commands output the changelog to `stdout`.

Instead of executing a shell command, a (Handlebars) template can be used to generate the changelog. See
[auto-changelog](./docs/changelogs#auto-changelog) for more details. If your project follows conventions, such as the
[Angular commit guidelines](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits), the
[@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) plugin is useful.

→ See [Changelog](./docs/changelog.md) for more details.

## Publish to npm

With a `package.json` in the current directory, release-it will let `npm` bump the version in `package.json` (and
`package-lock.json` if present), and publish to the npm registry.

→ See [Publish to npm](./docs/npm.md) for more details.

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

- Pre-releases work in tandem with [recommended bumps](https://github.com/release-it/conventional-changelog).
- You can still override individual options, e.g. `release-it --preRelease=rc --npm.tag=next`.
- See [semver.org](http://semver.org) for more details about semantic versioning.

## Hooks

Use script hooks to run shell commands at any moment during the release process. The format is `[prefix]:[hook]` or
`[prefix]:[namespace]:[hook]`:

- The `prefix` is one of `before` or `after`.
- Use the optional `namespace` to precisely hook into a life cycle method between specific plugins. The core plugins
  include `version`, `git`, `npm`, `github`, `gitlab`. When using a custom plugin, that name will also be available
  (e.g. `@release-it/conventional-changelog` has the `conventional-changelog` namespace).
- The `hook` is one of `init`, `bump` or `release`. Note that `beforeBump`, `beforeRelease` and `afterRelease` are also
  available to be on par with plugins, but they sound and usually are redundant in the context of script hooks.

All commands can use configuration variables (like template strings). An array of commands can also be provided, they
will run one after another. Some examples:

```json
{
  "hooks": {
    "before:init": ["npm run lint", "npm test"],
    "after:my-plugin:bump": "./bin/my-script.sh",
    "after:git:release": "npm run build",
    "after:release": "echo Successfully released ${name} v${version} to ${repo.repository}."
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

All variables are available in all hooks. The only exception is that the additional variables listed above are not
available in the `init` hook.

## Scripts (deprecated)

Please use [hooks](#hooks) instead, as hooks are more flexible. The `scripts` will stay for a while, but will be removed
in a few major releases after v12. Here's how to migrate:

- `scripts.beforeStart` → `hooks.before:init`
- `scripts.beforeBump` → `hooks.before:bump`
- `scripts.afterBump` → `hooks.after:bump`
- `scripts.beforeStage` → `hooks.before:release`
- `scripts.afterRelease` → `hooks.after:release`

## Plugins

Since v11, release-it can be extended in many, many ways.

→ See [plugins](./docs/plugins/README.md) for more details.

## Distribution repository

Some projects use a distribution repository. Generated files (such as compiled assets or documentation) can be
distributed to a separate repository. Or to a separate branch, such as a `gh-pages`. Some examples include
[shim repositories](https://github.com/components) and a separate
[packaged Angular.js repository](https://github.com/angular/bower-angular) for distribution on npm and Bower.

The `dist.repo` option was removed in v10, but similar setups can still be achieved. Please see the
[distribution repository](./docs/recipes/distribution-repo.md) recipe for example configurations.

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
[use release-it programmatically](./docs/recipes/programmatic.md) for example code.

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
