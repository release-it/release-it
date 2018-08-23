# Release It! 🚀

CLI release tool for Git repos and npm packages.

**Release It!** automates the tedious tasks of software releases:

<img align="right" src="./assets/release-it.gif?raw=true" height="148">

* Execute build commands
* Bump version (in e.g. `package.json`)
* Generate changelog
* Git commit, tag, push
* [Create release at GitHub](#️-github-release)
* [Upload assets to GitHub release](#-release-assets)
* Publish to npm
* [Manage pre-releases](#-manage-pre-releases)
* Support [Conventional Changelog workflows](#custom-or-conventional-changelog)
* [Push build artifacts to a distribution repository](#-distribution-repository)

[![Build Status](https://travis-ci.org/webpro/release-it.svg?branch=master)](https://travis-ci.org/webpro/release-it)
[![npm version](https://badge.fury.io/js/release-it.svg)](https://badge.fury.io/js/release-it)
[![Greenkeeper badge](https://badges.greenkeeper.io/webpro/release-it.svg)](https://greenkeeper.io/)

<details>
 <summary><strong>Table of Contents</strong> (click to expand)</summary>

* [Installation](#-installation)
* [Usage](#️-usage)
* [Configuration](#️-configuration)
* [Interactive vs. non-interactive mode](#-interactive-vs-non-interactive-mode)
* [Command Hooks](#-command-hooks)
* [SSH keys & git remotes](#-ssh-keys-git-remotes)
* [GitHub Release](#️-github-release)
* [Release Assets](#-release-assets)
* [Manage Pre-releases](#-manage-pre-releases)
* [Custom or Conventional Changelog](#custom-or-conventional-changelog)
* [Distribution Repository](#-distribution-repository)
* [Notes](#-notes)
* [Troubleshooting & debugging](#-troubleshooting--debugging)
* [Using release-it Programmatically](#-using-release-it-programmatically)
* [Examples](#-examples)
* [Resources](#-resources)
* [Contributing](#-contributing)
* [Credits](#️-credits)
* [License](#-license)
</details>


## 💾 Installation

### Global

As a globally available CLI tool:

```bash
npm install --global release-it
```

### Local

As a `devDependency` in your project:

```
npm install --save-dev release-it
```

Add this as a `script` to `package.json`:

```
{
  "name": "my-package",
  "version": "1.0.0",
  "scripts": {
    "release": "release-it"
  },
  "devDependencies": {
    "release-it": "^7.4.7"
  }
}
```

Now you can run `npm run release` from the command line.

## ▶️ Usage

Release a new patch (increments from e.g. `1.0.4` to `1.0.5`):

```bash
release-it
```

Release a patch, minor, major, or specific version:

```bash
release-it minor
release-it 0.8.3
```

See [manage pre-releases](#-manage-pre-releases) for versions like `1.0.0-beta.2` and `npm install my-package@next`.

You can also do a "dry run", which won't write/touch anything, but does output the commands it would execute, and show the interactivity:

```bash
release-it --dry-run
```

## ⚙️ Configuration

Out of the box, release-it has sane defaults, and plenty of options to configure it. Put the options to override in `.release-it.json` in the project root. Example:

```
{
  "src": {
    "tagName": "v%s"
  },
  "github": {
    "release": true
  }
}
```

* Only the settings to override need to be in `.release-it.json`. Everything else will fall back to the [default configuration](conf/release-it.json).
* You can use `--config` if you want to use another path for the local `.release-it.json`. 

Any option can also be set on the command-line, and will have highest priority. Example:

```bash
release-it minor --src.tagName='v%s' --github.release
```

Boolean arguments can be negated by using the `no-` prefix:

```bash
release-it --no-npm.publish
```

## 🤖 Interactive vs. non-interactive mode

By default, release-it is interactive and allows you to confirm each task before execution:

<img src="./assets/release-it.png?raw=true" height="148">

On a Continuous Integration (CI) environment, or by using the `-n` option, this is fully automated. No prompts are shown and the configured tasks will be executed. This is demonstrated in the first animation above. An overview of the tasks:

Task | Option | Default | Prompt | Default
:--|:--|:-:|:--|:-:
Ready (confirm version) | N/A | N/A | - | `Y`
Show staged files | N/A | N/A | `prompt.src.status` | `N`
Git commit | `src.commit` | `true` | `prompt.src.commit` | `Y`
Git tag | `src.tag` | `true` | `prompt.src.tag` | `Y`
Git push | `src.push` | `true` | `prompt.src.push` | `Y`
GitHub release | `github.release` | `false` | `prompt.src.release` | `Y`
npm publish | `npm.publish` | `true` | `prompt.src.publish` | `Y`

The "Option" + "Default" columns represent default options in non-interactive/CI mode. The "Prompt" + "Default" columns represent the prompts and their default answers in interactive mode. You can still change the answer to either `Y` or `N` as the questions show up (or cancel the process with `Ctrl-c`).

Note that, if an option (e.g. `npm.publish`) is `false`, the related prompt (`prompt.src.publish`) will not be shown at all in interactive mode (regardless of its default answer).

## 🔗 Command Hooks

The command hooks are executed from the root directory of the `src` or `dist` repository, respectively:

* `src.beforeStartCommand`
* `beforeChangelogCommand`
* `buildCommand` - before files are staged for commit
* `src.afterReleaseCommand`
* `dist.beforeStageCommand` - before files are staged in dist repo
* `dist.afterReleaseCommand`

All commands can use configuration variables (like template strings):

```bash
"buildCommand": "tar -czvf foo-${src.tagName}.tar.gz ",
"afterReleaseCommand": "echo Successfully released ${version} to ${dist.repo}."
```

The variables can be found in the [default configuration](https://github.com/webpro/release-it/blob/master/conf/release-it.json). Additionally, `version`, `latestVersion` and `changelog` are exposed in custom commands. Also the `repo` object (with properties `remote`, `protocol`, `host`, `owner`, `repository` and `project`) is available.

## 📡 SSH keys & git remotes

The tool assumes SSH keys and Git remotes to be configured correctly. If `git push` works, release-it should work. Otherwise, the following GitHub help pages might be useful: [SSH](https://help.github.com/articles/connecting-to-github-with-ssh/) and [Managing Remotes](https://help.github.com/categories/managing-remotes/).

## ✏️ GitHub Release

See this project's [releases page](https://github.com/webpro/release-it/releases) for an example. To create [GitHub releases](https://help.github.com/articles/creating-releases/):

* The `github.release` option must be `true`.
* Obtain a [GitHub access token](https://github.com/settings/tokens) (release-it only needs "repo" access; no "admin" or other scopes).
* Make sure the token is available as an environment variable. Example:

```bash
export GITHUB_TOKEN="f941e0..."
```

Do not put the actual token in the `github.tokenRef` configuration, it should be the name of the environment variable.

### 📦 Release Assets

To upload binary release assets with a GitHub release (such as compiled executables,
minified scripts, documentation), provide one or more glob patterns for the `github.assets` option. After the release, the assets are available to download from the GitHub release page. Example:

```json
"github": {
  "release": true,
  "assets": "dist/*.zip"
}
```

## 🐣 Manage Pre-releases

With release-it, it's easy to create pre-releases: a version of your software that you want to make available, while it's not in the stable semver range yet. Often "alpha", "beta", and "rc" (release candidate) are used as identifier for pre-releases.

For example, if you're working on a new major update for `awesome-pkg` (while the latest release was v1.4.1), and you want others to try your latest beta version:

```
release-it major --preRelease=beta
```

This will tag and release version `2.0.0-beta.0`. This is actually a shortcut for:

```
release-it premajor --preReleaseId=beta --npm.tag=beta --github.preRelease
```

Consecutive beta releases (`v2.0.0-beta.1` and so on) are now easy:

```
release-it --preRelease=beta
```

Installing the package with npm:

```
npm install awesome-pkg         # Installs v1.4.1
npm install awesome-pkg@beta    # Installs v2.0.0-beta.1
```

You can still override individual options, e.g. the npm tag being used:

```
release-it --preRelease=rc --npm.tag=next
```

See [semver.org](http://semver.org) for more details about semantic versioning.

## Custom or Conventional Changelog

### Recommended Bump

If your project follows conventions, such as the [Angular commit guidelines](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits), the special `conventional:angular` increment shorthand can be used to get the recommended bump based on the commit messages:

```
{
  "increment": "conventional:angular"
}
```

Please find the [list of available conventions](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages) (`angular`, `ember`, etc).

### Generate Custom Changelog

With release-it, you can use tools like [conventional-changelog-cli](https://www.npmjs.com/package/conventional-changelog-cli) to generate the changelog for the GitHub release. Make sure that the command defined in the `changelogCommand` option outputs the changelog to `stdout`. In the next example, `beforeChangelogCommand` is also used, to update the `CHANGELOG.md` file. This change will also be included in the release commit.

```
{
  "increment": "conventional:angular",
  "beforeChangelogCommand": "conventional-changelog -p angular -i CHANGELOG.md -s",
  "changelogCommand": "conventional-changelog -p angular | tail -n +3",
  "safeBump": false
}
```

For this use case, the `safeBump` option was introduced. Set this to `false` to bump `package.json#version` _before_ the `beforeChangelogCommand` is executed, as the `conventional-changelog` tool needs to run from the current version.

## 🚚 Distribution Repository

Some projects use a distribution repository. Generated files (such as compiled assets or documentation) can be distributed to a separate repository. Or to a separate branch, such as a `gh-pages` (also see [Using GitHub Pages, the easy way](https://medium.com/@webprolific/using-github-pages-the-easy-way-bb7acc46f45b)).

Some examples include [shim repositories](https://github.com/components) and a separate [packaged Angular.js repository](https://github.com/angular/bower-angular) for distribution on npm and Bower.

To use this feature, set the `dist.repo` option to a git endpoint. An example configuration:

```json
"buildCommand": "npm run build",
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
```

With this example, `dist.repo` will be cloned to `.stage`. Then from the source repo `npm run build` is executed, and the generated files at `dist/**.*` will be copied to the `.stage` directory. The result is pushed back to `dist.repo`. Additionally, a GitHub release is created, and the package is published to npm.

## 📝 Notes

* The `"private": true` setting in package.json will be respected and the package won't be published to npm.
* By default, untracked files are not added to the release commit. Use `src.addUntrackedFiles: true` to override this behavior.
* You can use `src.pushRepo` option to set an alternative url or name of a remote as in `git push <src.pushRepo>`. By default this is `null` and  `git push` is used when pushing to the remote.

## 🐛 Troubleshooting & debugging

* Use `--verbose` to output commands that release-it executes.
* Use `--debug` to output configuration and additional (error) logs.
* Use `DEBUG=octokit:rest* release-it [...]` for debug logs with GitHub releases & assets.

## ⏩ Using release-it Programmatically

From Node.js scripts, release-it can also be used as a dependency:

```
const releaseIt = require('release-it');

releaseIt(options).then(output => {
  console.log(output);
  // { version, latestVersion, changelog }
});
```

## 💼 Examples

* [StevenBlack/hosts](https://github.com/StevenBlack/hosts)
* [infor-design/enterprise](https://github.com/infor-design/enterprise)
* [InCuca/vue-standalone-component](https://github.com/InCuca/vue-standalone-component)
* [parsable/react-truncate-markup](https://github.com/parsable/react-truncate-markup)
* [tsqllint/tsqllint](https://github.com/tsqllint/tsqllint)
* [adr/madr](https://github.com/adr/madr)
* GitHub search for [projects with .release-it.json](https://github.com/search?o=desc&q=in%3Apath+.release-it.json&s=indexed&type=Code)

## 📚 Resources

* [semver.org](http://semver.org)
* [GitHub Help](https://help.github.com) (→ [About Releases](https://help.github.com/articles/about-releases/))
* [npm Blog: Publishing what you mean to publish](http://blog.npmjs.org/post/165769683050/publishing-what-you-mean-to-publish)
* [npm Documentation: package.json](https://docs.npmjs.com/files/package.json)
* [Prereleases and npm](https://medium.com/@mbostock/prereleases-and-npm-e778fc5e2420)
* [Glob Primer (node-glob)](https://github.com/isaacs/node-glob#glob-primer) (release-it uses [globby](https://github.com/sindresorhus/globby#readme))

## 🎁 Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md).

## ❤️ Credits

Major dependencies:

* [ShellJS](https://documentup.com/shelljs/shelljs)
* [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)
* [@octokit/rest](https://github.com/octokit/rest.js)

The following Grunt plugins have been a source of inspiration:

* [grunt-release](https://github.com/geddski/grunt-release)
* [grunt-release-component](https://github.com/walmartlabs/grunt-release-component)

## 🎓 License

[MIT](http://webpro.mit-license.org/)
