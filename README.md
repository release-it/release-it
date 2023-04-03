# Release It! 🚀

🚀 Generic CLI tool to automate versioning and package publishing related tasks:

<img align="right" src="./docs/assets/release-it.svg?raw=true" height="280">

- Bump version (in e.g. `package.json`)
- [Git commit, tag, push](#git)
- Execute any (test or build) commands using [hooks](#hooks)
- [Create release at GitHub](#github-releases) or [GitLab](#gitlab-releases)
- [Generate changelog](#changelog)
- [Publish to npm](#publish-to-npm)
- [Manage pre-releases](#manage-pre-releases)
- Extend with [plugins](#plugins)
- Release from any [CI/CD environment](./docs/ci.md)

Use release-it for version management and publish to anywhere with its versatile configuration, a powerful plugin
system, and hooks to execute any command you need to test, build, and/or publish your project.

[![Action Status](https://github.com/release-it/release-it/workflows/Cross-OS%20Tests/badge.svg)](https://github.com/release-it/release-it/actions)
[![npm version](https://badge.fury.io/js/release-it.svg)](https://www.npmjs.com/package/release-it)

## Installation

Although release-it is a **generic** release tool, most projects use it for projects with npm packages. The recommended
way to install release-it uses npm and adds some minimal configuration to get started:

```bash
npm init release-it
```

Alternatively, install it manually, and add the `release` script to `package.json`:

```bash
npm install -D release-it
```

```json
{
  "name": "my-package",
  "version": "1.0.0",
  "scripts": {
    "release": "release-it"
  },
  "devDependencies": {
    "release-it": "^15.10.0"
  }
}
```

## Usage

Run release-it from the root of the project using either `npm run` or `npx`:

```bash
npm run release
npx release-it
```

You will be prompted to select the new version, and more prompts will follow based on your configuration.

## Yarn

Using Yarn? Please see the [npm section on Yarn](./docs/npm.md#yarn).

## Global Installation

Per-project installation as shown above is recommended, but global installs are supported as well:

- From npm: `npm install -g release-it`
- From Homebrew: `brew install release-it`

## GitHub Actions

Want to use release-it with GitHub Actions to fully automate the whole process? Enjoy this great walk-through:
[How to use GitHub Actions & Release-It to Easily Release Your Code](https://www.youtube.com/watch?v=7pBcuT7j_A0) (by
[David from Kodaps](https://twitter.com/KodapsAcademy)).

→ See [Continuous Integration environments](./docs/ci.md) for more details.

## Configuration

Out of the box, release-it has sane defaults, and [plenty of options](./config/release-it.json) to configure it. Most
projects use a `.release-it.json` file in the project root, or a `release-it` property in `package.json`.

→ See [Configuration](./docs/configuration.md) for more details.

Here's a quick example `.release-it.json`:

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

## Interactive vs. CI mode

By default, release-it is **interactive** and allows you to confirm each task before execution:

<img src="./docs/assets/release-it-interactive.gif?raw=true" height="290">

By using the `--ci` option, the process is fully automated without prompts. The configured tasks will be executed as
demonstrated in the first animation above. On a Continuous Integration (CI) environment, this non-interactive mode is
activated automatically.

Use `--only-version` to use a prompt only to determine the version, and automate the rest.

## Latest version

How does release-it determine the latest version?

1. For projects with a `package.json`, its `version` will be used (see [npm](./docs/npm.md) to skip this).
2. Otherwise, release-it uses the latest Git tag to determine which version should be released.
3. As a last resort, `0.0.0` will be used as the latest version.

Alternatively, a plugin can be used to override this (e.g. to manage a `VERSION` or `composer.json` file):

- [@release-it/bumper](https://github.com/release-it/bumper) to read from or bump the version in any file
- [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) to get a recommended bump
  based on commit messages
- [release-it-calver-plugin](https://github.com/casmith/release-it-calver-plugin) to use CalVer (Calendar Versioning)

Add the `--release-version` flag to print the **next** version without releasing anything.

## Git

Git projects are supported well by release-it, automating the tasks to stage, commit, tag and push releases to any Git
remote.

→ See [Git](./docs/git.md) for more details.

## GitHub Releases

GitHub projects can have releases attached to Git tags, containing release notes and assets. There are two ways to add
[GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) in your
release-it flow:

1. Automated (requires a `GITHUB_TOKEN`)
2. Manual (using the GitHub web interface with pre-populated fields)

→ See [GitHub Releases](./docs/github-releases.md) for more details.

## GitLab Releases

GitLab projects can have releases attached to Git tags, containing release notes and assets. To automate
[GitLab releases](https://docs.gitlab.com/ce/user/project/releases/):

- Configure `gitlab.release: true`
- Obtain a [personal access token](https://gitlab.com/profile/personal_access_tokens) (release-it only needs the "api"
  scope).
- Make sure the token is [available as an environment variable](./docs/environment-variables.md).

→ See [GitLab Releases](./docs/gitlab-releases.md) for more details.

## Changelog

By default, release-it generates a changelog, to show and help select a version for the new release. Additionally, this
changelog serves as the release notes for the GitHub or GitLab release.

The [default command](./config/release-it.json) is based on `git log ...`. This setting (`git.changelog`) can be
overridden. To further customize the release notes for the GitHub or GitLab release, there's `github.releaseNotes` or
`gitlab.releaseNotes`. Make sure any of these commands output the changelog to `stdout`. Note that release-it by default
is agnostic to commit message conventions. Plugins are available for:

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

## Update or re-run existing releases

Use `--no-increment` to not increment the last version, but update the last existing tag/version.

This may be helpful in cases where the version was already incremented. Here's a few example scenarios:

- To update or publish a (draft) GitHub Release for an existing Git tag.
- Publishing to npm succeeded, but pushing the Git tag to the remote failed. Then use
  `release-it --no-increment --no-npm` to skip the `npm publish` and try pushing the same Git tag again.

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

Note that hooks like `after:git:release` will not run when either the `git push` failed, or when it is configured not to
be executed (e.g. `git.push: false`). See [execution order](./docs/plugins.md#execution-order) for more details on
execution order of plugin lifecycle methods.

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

```text
version
latestVersion
changelog
name
repo.remote, repo.protocol, repo.host, repo.owner, repo.repository, repo.project
branchName
```

All variables are available in all hooks. The only exception is that the additional variables listed above are not yet
available in the `init` hook.

Use `--verbose` to log the output of the commands.

For the sake of verbosity, the full list of hooks is actually: `init`, `beforeBump`, `bump`, `beforeRelease`, `release`
or `afterRelease`. However, hooks like `before:beforeRelease` look weird and are usually not useful in practice.

Note that arguments need to be quoted properly when used from the command line:

```bash
release-it --'hooks.after:release="echo Successfully released ${name} v${version} to ${repo.repository}."'
```

Using Inquirer.js inside custom hook scripts might cause issues (since release-it also uses this itself).

## Dry Runs

Use `--dry-run` to show the interactivity and the commands it _would_ execute.

→ See [Dry Runs](./docs/dry-runs.md) for more details.

To print the next version without releasing anything, add the `--release-version` flag.

To print the changelog without releasing anything, add the `--changelog` flag.

## Troubleshooting & debugging

- With `release-it --verbose` (or `-V`), release-it prints the output of every user-defined [hook](#hooks).
- With `release-it -VV`, release-it also prints the output of every internal command.
- Use `NODE_DEBUG=release-it:* release-it [...]` to print configuration and more error details.

Use `verbose: 2` in a configuration file to have the equivalent of `-VV` on the command line.

## Plugins

Since v11, release-it can be extended in many, many ways. Here are some plugins:

| Plugin                                                                                       | Description                                                                   |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [@release-it/bumper](https://github.com/release-it/bumper)                                   | Read & write the version from/to any file                                     |
| [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog)   | Provides recommended bump, conventional-changelog, and updates `CHANGELOG.md` |
| [@release-it/keep-a-changelog](https://github.com/release-it/keep-a-changelog)               | Maintain CHANGELOG.md using the Keep a Changelog standards                    |
| [@release-it-plugins/lerna-changelog](https://github.com/release-it-plugins/lerna-changelog) | Integrates lerna-changelog into the release-it pipeline                       |
| [@release-it-plugins/workspaces](https://github.com/release-it-plugins/workspaces)           | Releases each of your projects configured workspaces                          |
| [release-it-calver-plugin](https://github.com/casmith/release-it-calver-plugin)              | Enables Calendar Versioning (calver) with release-it                          |
| [@grupoboticario/news-fragments](https://github.com/grupoboticario/news-fragments)           | An easy way to generate your changelog file                                   |
| [@j-ulrich/release-it-regex-bumper](https://github.com/j-ulrich/release-it-regex-bumper)     | Regular expression based version read/write plugin for release-it             |

Internally, release-it uses its own plugin architecture (for Git, GitHub, GitLab, npm).

→ See all [release-it plugins on npm](https://www.npmjs.com/search?q=keywords:release-it-plugin).

→ See [plugins](./docs/plugins.md) for documentation to write plugins.

## Use release-it programmatically

While mostly used as a CLI tool, release-it can be used as a dependency to integrate in your own scripts. See
[use release-it programmatically](./docs/recipes/programmatic.md) for example code.

## Example projects using release-it

- [axios/axios](https://github.com/axios/axios)
- [blockchain/blockchain-wallet-v4-frontend](https://github.com/blockchain/blockchain-wallet-v4-frontend)
- [callstack/react-native-paper](https://github.com/callstack/react-native-paper)
- [ember-cli/ember-cli](https://github.com/ember-cli/ember-cli)
- [js-cookie/js-cookie](https://github.com/js-cookie/js-cookie)
- [metalsmith/metalsmith](https://github.com/metalsmith/metalsmith)
- [mozilla/readability](https://github.com/mozilla/readability)
- [pahen/madge](https://github.com/pahen/madge)
- [redis/node-redis](https://github.com/redis/node-redis)
- [reduxjs/redux](https://github.com/reduxjs/redux)
- [saleor/saleor](https://github.com/saleor/saleor)
- [Semantic-Org/Semantic-UI-React](https://github.com/Semantic-Org/Semantic-UI-React)
- [shipshapecode/shepherd](https://github.com/shipshapecode/shepherd)
- [StevenBlack/hosts](https://github.com/StevenBlack/hosts)
- [swagger-api/swagger-ui](https://github.com/swagger-api/swagger-ui) +
  [swagger-editor](https://github.com/swagger-api/swagger-editor)
- [tabler/tabler](https://github.com/tabler/tabler) + [tabler-icons](https://github.com/tabler/tabler-icons)
- [youzan/vant](https://github.com/youzan/vant)
- [Repositories that depend on release-it](https://github.com/release-it/release-it/network/dependents)
- GitHub search for [path:\*\*/.release-it.json](https://github.com/search?q=path%3A**%2F.release-it.json&type=code)

## Legacy Node.js

The latest major version is v15, supporting Node.js 14 and up (as Node.js v12 is EOL). Use release-it v14 for
environments running Node.js v10 and v12. Also see [CHANGELOG.md](./CHANGELOG.md).

## Links

- See [CHANGELOG.md](./CHANGELOG.md) for major/breaking updates, and
  [releases](https://github.com/release-it/release-it/releases) for a detailed version history.
- To **contribute**, please read [CONTRIBUTING.md](./.github/CONTRIBUTING.md) first.
- Please [open an issue](https://github.com/release-it/release-it/issues/new) if anything is missing or unclear in this
  documentation.

## License

[MIT](./LICENSE)
