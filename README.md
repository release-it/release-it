# Release It! 🚀

CLI release tool for Git repos and npm packages.

**Release It!** automates the tedious tasks of software releases:

<img align="right" src="./assets/release-it.gif?raw=true" height="170">

- Execute test & build commands
- Bump version (in e.g. `package.json`)
- Generate changelog
- Git commit, tag, push
- [Publish to npm](#publishing-to-npm)
- [Create release at GitHub](#github-releases)
- [Upload assets to GitHub release](#release-assets)
- [Manage pre-releases](#managing-pre-releases)
- Support [Conventional Changelog](#custom-or-conventional-changelog) workflows
- Support [monorepo](#monorepos) workflows
- Push build artifacts to a [distribution repository](#distribution-repository)

[![Build Status](https://travis-ci.org/webpro/release-it.svg?branch=master)](https://travis-ci.org/webpro/release-it)
[![npm version](https://badge.fury.io/js/release-it.svg)](https://badge.fury.io/js/release-it)
[![Greenkeeper badge](https://badges.greenkeeper.io/webpro/release-it.svg)](https://greenkeeper.io/)

<details>
  <summary><strong>Table of Contents</strong> (click to expand)</summary>

<!-- toc -->

- [Usage](#usage)
- [Configuration](#configuration)
- [Interactive vs. non-interactive mode](#interactive-vs-non-interactive-mode)
- [Git](#git)
- [GitHub Releases](#github-releases)
- [Publishing to npm](#publishing-to-npm)
- [Managing pre-releases](#managing-pre-releases)
- [Scripts](#scripts)
- [Monorepos](#monorepos)
- [Custom or Conventional Changelog](#custom-or-conventional-changelog)
- [Distribution repository](#distribution-repository)
- [Metrics](#metrics)
- [Troubleshooting & debugging](#troubleshooting--debugging)
- [Using release-it programmatically](#using-release-it-programmatically)
- [Examples](#examples)
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

You will be prompted to select the new version. To skip the first prompt and release a patch, minor, major, or specific version:

```bash
release-it minor
release-it 0.8.3
```

See [manage pre-releases](#managing-pre-releases) for versions like `1.0.0-beta.2` and npm tags.
You can also do a "dry run", which won't write/touch anything, but does output the commands it would execute, and show the interactivity:

```bash
release-it --dry-run
```

## Configuration

Out of the box, release-it has sane defaults, and [plenty of options](conf/release-it.json) to configure it. Put the options to override in `.release-it.json` in the project root. Example:

```json
{
  "src": {
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

- Only the settings to override need to be in `.release-it.json` (or `package.json`). Everything else will fall back to the [default configuration](conf/release-it.json).
- You can use `--config` if you want to use another path for `.release-it.json`.

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

By using the `-n` option (i.e. **non-interactive**), the process is fully automated without prompts. The configured tasks will be executed as demonstrated in the first animation above.

On a Continuous Integration (CI) environment, the non-interactive mode is activated automatically.

<details>
  <summary><strong>An overview of the tasks</strong> (click to expand)</summary>

| Task           | Option           | Default | Prompt           | Default |
| :------------- | :--------------- | :-----: | :--------------- | :-----: |
| Git commit     | `git.commit`     | `true`  | `prompt.commit`  |   `Y`   |
| Git tag        | `git.tag`        | `true`  | `prompt.tag`     |   `Y`   |
| Git push       | `git.push`       | `true`  | `prompt.push`    |   `Y`   |
| GitHub release | `github.release` | `false` | `prompt.release` |   `Y`   |
| npm publish    | `npm.publish`    | `true`  | `prompt.publish` |   `Y`   |

The **Option/Default** columns represent default options in **non-interactive/CI** mode. The **Prompt/Default** columns represent the prompts and their default answers in **interactive** mode. You can still change the answer to either `Y` or `N` as the questions show up (or cancel the process with `Ctrl-c`).

If an option is set to `false`, the related prompt will not be shown at all in interactive mode (regardless of its default answer).

</details>

## Git

### SSH keys & Git remotes

SSH keys and Git remotes are assumed to be configured correctly. If a manual `git push` from the command line works, release-it should be able to do the same.

The following GitHub help pages might be useful: [SSH](https://help.github.com/articles/connecting-to-github-with-ssh/) and [Managing Remotes](https://help.github.com/categories/managing-remotes/).

### Remote repository

By default, `release-it` uses `origin` as the remote name to push to. Use `git.pushRepo` to override this with a different remote name (or a different git url).

### Extra arguments

In case extra arguments should be provided to Git, these options are available:

- `git.commitArgs`
- `git.tagArgs`
- `git.pushArgs`

For example, use `"git.commitArgs": "-S"` to sign commits (also see [#35](https://github.com/webpro/release-it/issues/350)).

### Untracked files

By default, untracked files are not added to the release commit. Use `git.addUntrackedFiles: true` to override this behavior.

## GitHub Releases

The "Releases" tab on GitHub projects links to a page to store the changelog. To add [GitHub releases](https://help.github.com/articles/creating-releases/) in your release-it flow:

- Configure `github.release: true`.
- Obtain a [GitHub access token](https://github.com/settings/tokens) (release-it only needs "repo" access; no "admin" or other scopes).
- Make sure the token is available as an environment variable. Example:

```bash
export GITHUB_TOKEN="f941e0..."
```

Do not put the actual token in the release-it configuration. It will be read from the `GITHUB_TOKEN` environment variable. You can change this variable name by setting the `github.tokenRef` option to something else.

Obviously, release-it uses this feature extensively: [release-it's releases page](https://github.com/webpro/release-it/releases).

### Release assets

To upload binary release assets with a GitHub release (such as compiled executables,
minified scripts, documentation), provide one or more glob patterns for the `github.assets` option. After the release, the assets are available to download from the GitHub release page. Example:

```json
{
  "github": {
    "release": true,
    "assets": ["dist/*.zip"]
  }
}
```

## Publishing to npm

No configuration is needed to publish the package to npm, as `npm.publish` is `true` by default. If a manual `npm publish` from the command line works, release-it delegating to `npm-publish` should behave the same. The `"private": true` setting in package.json will be respected, and `release-it` will skip this step.

Getting an `ENEEDAUTH` error while a manual `npm publish` works? Please see [#95](https://github.com/webpro/release-it/issues/95#issuecomment-344919384).

### Public scoped packages

Set `npm.access` to `"public"` to [publish scoped packages](https://docs.npmjs.com/misc/scope#publishing-scoped-packages), or make sure this is in `package.json`:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

### Two-factor authentication

In case two-factor authentication (2FA) is enabled for the package, release-it will ask for the one-time password (OTP). Notes:

The OTP can be provided from the command line (`--npm.otp=123456`). However, providing the OTP without a prompt basically defeats the purpose of 2FA (also, the OTP expires after a short period).

## Managing pre-releases

With release-it, it's easy to create pre-releases: a version of your software that you want to make available, while it's not in the stable semver range yet. Often "alpha", "beta", and "rc" (release candidate) are used as identifier for pre-releases.

An example. The `awesome-pkg` is at version 1.4.1, and work is done for a new major update. To publish the latest beta of the new major version:

```
release-it major --preRelease=beta
```

This will tag and release version `2.0.0-beta.0`. Notes:

- A normal installation of `awesome-pkg` will still be at version 1.4.1.
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

And when ready to release the next phase (e.g. release candidate):

```
release-it --preRelease=rc
```

And eventually, for `2.0.0`:

```
release-it major
```

Notes:

- Pre-releases can work together with [recommended bumps](#recommended-bump).
- You can still override individual options (e.g. `release-it --preRelease=rc --npm.tag=next`).
- See [semver.org](http://semver.org) for more details about semantic versioning.

## Scripts

The scripts (previously "command hooks") are executed from the root directory of the `src` or `dist` repository, respectively:

- `scripts.beforeStart`
- `scripts.beforeBump`
- `scripts.afterBump`
- `scripts.beforeStage`
- `scripts.afterRelease`

All commands can use configuration variables (like template strings). Some examples:

```json
{
  "scripts": {
    "beforeStart": "npm test",
    "afterBump": "tar -czvf foo-${version}.tar.gz",
    "afterRelease": "echo Successfully released ${name} v${version} to ${repo.repository}."
  }
}
```

The variables can be found in the [default configuration](https://github.com/webpro/release-it/blob/master/conf/release-it.json). Additionally, the following variables are exposed:

```
version
latestVersion
changelog
name
repo.remote, repo.protocol, repo.host, repo.owner, repo.repository, repo.project
```

For [distribution repositories](#distribution-repository), two additional hooks are available:

- `dist.scripts.beforeStage`
- `dist.scripts.afterRelease`

## Monorepos

From a monorepo package subdirectory, release-it detects `package.json` is not in the same directory as the Git root.
Then it will take the latest version from this `package.json` rather than the latest Git tag.

In this case, `git.tag` should be set to `false`. For example, from `./packages/some-pkg`:

```
release-it --git.commitMessage='Release ${name} v${version}' --no-git.tag
```

## Custom or Conventional Changelog

### Recommended Bump

If your project follows conventions, such as the [Angular commit guidelines](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits), the special `conventional:angular` increment shorthand can be used to get the recommended bump based on the commit messages:

```json
{
  "increment": "conventional:angular"
}
```

Please find the [list of available conventions](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages) (`angular`, `ember`, etc).

### Generating a custom changelog

With release-it, you can use tools like [conventional-changelog-cli](https://www.npmjs.com/package/conventional-changelog-cli) to generate the changelog for the GitHub release. Make sure that the command defined in the `scripts.changelog` option outputs the changelog to `stdout`. In the next example, `scripts.afterBump` is also used, to update the `CHANGELOG.md` file.

```json
{
  "increment": "conventional:angular",
  "scripts": {
    "changelog": "conventional-changelog -p angular | tail -n +3",
    "afterBump": "conventional-changelog -p angular -i CHANGELOG.md -s"
  }
}
```

## Distribution repository

Some projects use a distribution repository. Generated files (such as compiled assets or documentation) can be distributed to a separate repository. Or to a separate branch, such as a `gh-pages` (also see [Using GitHub Pages, the easy way](https://medium.com/@webprolific/using-github-pages-the-easy-way-bb7acc46f45b)). Some examples include [shim repositories](https://github.com/components) and a separate [packaged Angular.js repository](https://github.com/angular/bower-angular) for distribution on npm and Bower.

To use this feature, set the `dist.repo` option to a git endpoint.

<details>
 <summary>An example configuration (click to expand)</summary>

```json
{
  "scripts": {
    "beforeStage": "npm run build"
  },
  "dist": {
    "repo": "git@github.com:components/ember.git",
    "stageDir": ".stage",
    "baseDir": "dist",
    "files": ["**/*"],
    "github": {
      "release": true
    },
    "npm": {
      "publish": true
    }
  }
}
```

With this example:

- The `dist.repo` will be cloned to `.stage`.
- From the root of source repo, `npm run build` is executed.
- The generated files at `dist/**.*` will be copied to the `.stage` directory.
- The result is pushed back to `dist.repo`.
- A GitHub release is created, and the package is published to npm.

</details>

## Metrics

Use `--disable-metrics` to disable sending some anonymous statistical data.

## Troubleshooting & debugging

- Use `--verbose` to output commands that release-it executes.
- Use `--debug` to output configuration and additional (error) logs.
- Use `DEBUG=octokit:rest* release-it [...]` for debug logs with GitHub releases & assets.

## Using release-it programmatically

From Node.js scripts, release-it can also be used as a dependency:

```js
const releaseIt = require('release-it');

releaseIt(options).then(output => {
  console.log(output);
  // { version, latestVersion, changelog }
});
```

## Examples

- [react-navigation/react-navigation](https://github.com/react-navigation/react-navigation)
- [swagger-api/swagger-ui](https://github.com/swagger-api/swagger-ui)
- [StevenBlack/hosts](https://github.com/StevenBlack/hosts)
- [react-native-community/react-native-tab-view](https://github.com/react-native-community/react-native-tab-view)
- [callstack/linaria](https://github.com/callstack/linaria)
- [vuejs/vuefire](https://github.com/vuejs/vuefire)
- [posva/vue-promised](https://github.com/posva/vue-promised)
- [blockchain/blockchain-wallet-v4-frontend](https://github.com/blockchain/blockchain-wallet-v4-frontend)
- [infor-design/enterprise](https://github.com/infor-design/enterprise)
- [tsqllint/tsqllint](https://github.com/tsqllint/tsqllint)
- [segmentio/typewriter](https://github.com/segmentio/typewriter)
- GitHub search for [projects with .release-it.json](https://github.com/search?o=desc&q=in%3Apath+.release-it.json&s=indexed&type=Code)

## Resources

- [semver.org](http://semver.org)
- [GitHub Help](https://help.github.com) (→ [About Releases](https://help.github.com/articles/about-releases/))
- [npm Blog: Publishing what you mean to publish](https://blog.npmjs.org/post/165769683050/publishing-what-you-mean-to-publish)
- [npm Documentation: package.json](https://docs.npmjs.com/files/package.json)
- [Prereleases and npm](https://medium.com/@mbostock/prereleases-and-npm-e778fc5e2420)
- [Glob Primer (node-glob)](https://github.com/isaacs/node-glob#glob-primer) (release-it uses [globby](https://github.com/sindresorhus/globby#readme))

## Credits

Major dependencies:

- [ShellJS](https://documentup.com/shelljs/shelljs)
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)
- [@octokit/rest](https://github.com/octokit/rest.js)

The following Grunt plugins have been a source of inspiration:

- [grunt-release](https://github.com/geddski/grunt-release)
- [grunt-release-component](https://github.com/walmartlabs/grunt-release-component)
