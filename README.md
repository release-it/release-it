# Release It! 🚀

🚀 Generic CLI tool to automate versioning and package publishing related tasks:

<img align="right" src="./docs/assets/release-it.gif?raw=true" height="280">

- Execute test & build commands
- Bump version (in e.g. `package.json`)
- [Git commit, tag, push](#git)
- [Create release at GitHub](#github-releases) or [GitLab](#gitlab-releases)
- [Generate changelog](#changelog)
- [Publish to npm](#publish-to-npm)
- [Manage pre-releases](#manage-pre-releases)
- [Hooks](#hooks)
- Extend with [plugins](#plugins)
- Release from any [CI/CD environment](./docs/ci.md)

[![Action Status](https://github.com/release-it/release-it/workflows/Cross-OS%20Tests/badge.svg)](https://github.com/release-it/release-it/actions)
[![npm version](https://badge.fury.io/js/release-it.svg)](https://badge.fury.io/js/release-it)
[![codecov](https://codecov.io/gh/release-it/release-it/branch/master/graph/badge.svg)](https://codecov.io/gh/release-it/release-it)

## Links

- See [CHANGELOG.md](./CHANGELOG.md) for major/breaking updates, and
  [releases](https://github.com/release-it/release-it/releases) for a detailed version history.
- To **contribute**, please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.
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
- [Git](#git)
- [GitHub Releases](#github-releases)
- [GitLab Releases](#gitlab-releases)
- [Changelog](#changelog)
- [Publish to npm](#publish-to-npm)
- [Manage pre-releases](#manage-pre-releases)
- [Hooks](#hooks)
- [Plugins](#plugins)
- [Distribution repository](#distribution-repository)
- [Metrics](#metrics)
- [Troubleshooting & debugging](#troubleshooting--debugging)
- [Use release-it programmatically](#use-release-it-programmatically)
- [Example projects using release-it](#example-projects-using-release-it)
- [Resources](#resources)

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

```bash
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

You will be prompted to select the new version, and more questions will follow based on your setup. For a "dry run" (to
show the interactivity and the commands it _would_ execute):

```bash
release-it --dry-run
```

Note: read-only commands are still executed (`$ ...`), while the rest is not (`! ...`):

```bash
$ git rev-parse --git-dir
.git
! git add package.json
! git commit --message="Release 0.8.3"
```

## Configuration

Out of the box, release-it has sane defaults, and [plenty of options](./config/release-it.json) to configure it. Put
(only) the options to override in a configuration file. This is where release-it looks for configuration:

- `.release-it.json`
- `.release-it.js` (export the configuration object: `module.exports = {}`)
- `.release-it.yaml` (or `.yml`)
- `.release-it.toml`
- `package.json` (in the `release-it` property)

Use `--config` to use another path for the configuration file. An example `.release-it.json`:

```json
{
  "git": {
    "commitMessage": "chore: release v${version}"
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

```yaml
git:
  requireCleanWorkingDir: false
```

Or TOML in `.release-it.toml`:

```toml
[hooks]
"before:init" = "npm test"
```

Any option can also be set on the command-line, and will have highest priority. Example:

```bash
release-it minor --git.requireBranch=master --github.release
```

Boolean arguments can be negated by using the `no-` prefix:

```bash
release-it --no-npm.publish
```

## Interactive vs. CI mode

By default, release-it is **interactive** and allows you to confirm each task before execution:

<img src="./docs/assets/release-it-interactive.gif?raw=true" height="290">

By using the `--ci` option, the process is fully automated without prompts. The configured tasks will be executed as
demonstrated in the first animation above. On a Continuous Integration (CI) environment, this non-interactive mode is
activated automatically.

## Latest version

For projects with a `package.json`, its `version` will be used. Otherwise, release-it uses the latest Git tag to
determine which version should be released. In any case, as a last resort, `0.0.0` will be used as the latest version.

Use `--no-increment` to not increment the version.

Use `--npm.ignoreVersion` to use the latest Git tag.

Use `--no-npm` (or `"npm": false`) to ignore and skip bumping `package.json` and skip `npm publish` altogether.

Alternatively, a plugin can be used to get the version from anywhere else (e.g. a `VERSION` file). Also see
[plugins](./docs/plugins.md).

## Git

Git projects are supported well by release-it, automating the tasks to stage, commit, tag and push releases to any Git
remote.

→ See [Git](./docs/git.md) for more details.

## GitHub Releases

The "Releases" tab on GitHub projects links to a page to store the changelog cq. release notes. To add
[GitHub releases](https://help.github.com/articles/creating-releases) in your release-it flow:

- Configure `github.release: true`.
- Obtain a [personal access token](https://github.com/settings/tokens) (release-it only needs "repo" access; no "admin"
  or other scopes).
- Make sure the token is [available as an environment variable](./docs/environment-variables.md).

→ See [GitHub Releases](./docs/github-releases.md) for more details.

## GitLab Releases

[GitLab releases](https://docs.gitlab.com/ee/workflow/releases.html#releases) work just like GitHub releases:

- Configure `gitlab.release: true`.
- Obtain a [personal access token](https://gitlab.com/profile/personal_access_tokens) (release-it only needs the "api"
  scope).
- Make sure the token is [available as an environment variable](./docs/environment-variables.md).

→ See [GitLab Releases](./docs/gitlab-releases.md) for more details.

## Changelog

By default, release-it generates a changelog, to show and help select a version for the new release. Additionally, this
changelog serves as the release notes for the GitHub or GitLab release.

The [default command](./config/release-it.json) is based on `git log ...`. This setting (`git.changelog`) can be
overridden. To customize the release notes for the GitHub or GitLab release, use `github.releaseNotes` or
`gitlab.releaseNotes`. Make sure any of these commands output the changelog to `stdout`. Topics include:

- GitHub and GitLab Releases
- auto-changelog
- Conventional Changelog
- Keep A Changelog

→ See [Changelog](./docs/changelog.md) for more details.

## Publish to npm

With a `package.json` in the current directory, release-it will let `npm` bump the version in `package.json` (and
`package-lock.json` if present), and publish to the npm registry.

→ See [Publish to npm](./docs/npm.md) for more details.

## Manage pre-releases

With release-it, it's easy to create pre-releases: a version of your software that you want to make available, while
it's not in the stable semver range yet. Often "alpha", "beta", and "rc" (release candidate) are used as identifier for
pre-releases. An example pre-release version is `2.0.0-beta.0`.

→ See [Manage pre-releases](./docs/pre-releases.md) for more details.

## Hooks

Use script hooks to run shell commands at any moment during the release process (such as `before:init` or
`after:release`).

The format is `[prefix]:[hook]` or `[prefix]:[plugin]:[hook]`:

| part   | value                                       |
| ------ | ------------------------------------------- |
| prefix | `before` or `after`                         |
| plugin | `version`, `git`, `npm`, `github`, `gitlab` |
| hook   | `init`, `bump`, `release`                   |

Use the optional `:plugin` part in the middle to hook into a life cycle method exactly before or after any plugin.

The core plugins include `version`, `git`, `npm`, `github`, `gitlab`.

See [execution order](./docs/plugins.md#execution-order) for more details on execution order of plugin lifecycle
methods.

All commands can use configuration variables (like template strings). An array of commands can also be provided, they
will run one after another. Some example release-it configuration:

```json
{
  "hooks": {
    "before:init": ["npm run lint", "npm test"],
    "after:my-plugin:bump": "./bin/my-script.sh",
    "after:bump": "npm run build",
    "after:git:release": "echo After git push, before github release",
    "after:release": "echo Successfully released ${name} v${version} to ${repo.repository}."
  }
}
```

The variables can be found in the [default configuration](./config/release-it.json). Additionally, the following
variables are exposed:

```
version
latestVersion
changelog
name
repo.remote, repo.protocol, repo.host, repo.owner, repo.repository, repo.project
```

All variables are available in all hooks. The only exception is that the additional variables listed above are not yet
available in the `init` hook.

Use `--verbose` to log the output of the commands.

For the sake of verbosity and to not complicate matters further, the above table is not complete. The full list of hooks
is actually: `init`, `beforeBump`, `bump`, `beforeRelease`, `release` or `afterRelease`. However, hooks like
`before:beforeRelease` look weird and are usually not useful in practice.

## Plugins

Since v11, release-it can be extended in many, many ways. Here are some plugins:

| Plugin                                                                                     | Description                                                                   |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [@release-it/bumper](https://github.com/release-it/bumper)                                 | Read & write the version from/to any file                                     |
| [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) | Provides recommended bump, conventional-changelog, and updates `CHANGELOG.md` |
| [release-it-lerna-changelog](https://github.com/rwjblue/release-it-lerna-changelog)        | Integrates lerna-changelog into the release-it pipeline                       |
| [release-it-yarn-workspaces](https://github.com/rwjblue/release-it-yarn-workspaces)        | Releases each of your projects configured workspaces                          |
| [@grupoboticario/news-fragments](https://github.com/grupoboticario/news-fragments)         | An easy way to generate your changelog file                                   |

Internally, release-it uses its own plugin architecture (for Git, GitHub, GitLab, npm).

→ See all [release-it plugins on npm](https://www.npmjs.com/search?q=keywords:release-it-plugin).

→ See [plugins](./docs/plugins.md) for more details.

## Distribution repository

Some projects use a distribution repository. Generated files (such as compiled assets or documentation) can be
distributed to a separate repository. Or to a separate branch, such as a `gh-pages`. Some examples include
[shim repositories](https://github.com/components) and a separate
[packaged Angular.js repository](https://github.com/angular/bower-angular) for distribution on npm and Bower.

The `dist.repo` option was removed in v10, but similar setups can still be achieved. Please see the
[distribution repository](./docs/recipes/distribution-repo.md) recipe for example configurations.

## Metrics

Use `--disable-metrics` to opt-out of sending some anonymous statistical data to Google Analytics. For details, refer to
[lib/metrics.js](./lib/metrics.js). Please consider to not opt-out: more data means more support for future development.

## Troubleshooting & debugging

- With `release-it --verbose` (or `-V`), release-it prints every custom script/hook and its output.
- With `release-it -VV`, release-it also prints every internal command and its output.
- Prepend `DEBUG=release-it:* release-it [...]` to print configuration and more error details.

Use `verbose: 2` to have the equivalent of `-VV` on the command line in a configuration file.

## Use release-it programmatically

While mostly used as a CLI tool, release-it can be used as a dependency to integrate in your own scripts. See
[use release-it programmatically](./docs/recipes/programmatic.md) for example code.

## Example projects using release-it

- [react-navigation/react-navigation](https://github.com/react-navigation/react-navigation)
- [swagger-api/swagger-ui](https://github.com/swagger-api/swagger-ui) +
  [swagger-editor](https://github.com/swagger-api/swagger-editor)
- [js-cookie/js-cookie](https://github.com/js-cookie/js-cookie)
- [StevenBlack/hosts](https://github.com/StevenBlack/hosts)
- [youzan/vant](https://github.com/youzan/vant/search?q=release-it)
- [antonmedv/fx](https://github.com/antonmedv/fx)
- [react-native-community/react-native-tab-view](https://github.com/react-native-community/react-native-tab-view)
- [callstack/linaria](https://github.com/callstack/linaria) +
  [react-native-paper](https://github.com/callstack/react-native-paper)
- [tabler/tabler-icons](https://github.com/tabler/tabler-icons)
- [blockchain/blockchain-wallet-v4-frontend](https://github.com/blockchain/blockchain-wallet-v4-frontend)
- [ember-cli/ember-cli](https://github.com/ember-cli/ember-cli)
- [shipshapecode/shepherd](https://github.com/shipshapecode/shepherd)
- [Repositories that depend on release-it](https://github.com/release-it/release-it/network/dependents)
- GitHub search for
  [projects with .release-it.json](https://github.com/search?o=desc&q=in%3Apath+.release-it.json&s=indexed&type=Code)

## Resources

- [semver.org](https://semver.org)
- [GitHub Help](https://help.github.com) (→ [About Releases](https://help.github.com/articles/about-releases))
- [npm Blog: Publishing what you mean to publish](https://blog.npmjs.org/post/165769683050/publishing-what-you-mean-to-publish)
- [npm Documentation: package.json](https://docs.npmjs.com/files/package.json)
- [Prereleases and npm](https://medium.com/@mbostock/prereleases-and-npm-e778fc5e2420)
- [Glob Primer (node-glob)](https://github.com/isaacs/node-glob#glob-primer) (release-it uses
  [globby](https://github.com/sindresorhus/globby#readme))
