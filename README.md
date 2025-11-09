# Release It! 🚀

🚀 Generic CLI tool to automate versioning and package publishing-related tasks:

<img align="right" src="./docs/assets/release-it.svg?raw=true" height="280" />

- Bump version (in e.g. `package.json`)
- [Git commit, tag, push][1]
- Execute any (test or build) commands using [hooks][2]
- [Create release at GitHub][3] or [GitLab][4]
- [Generate changelog][5]
- [Publish to npm][6]
- [Manage pre-releases][7]
- Extend with [plugins][8]
- Release from any [CI/CD environment][9]

Use release-it for version management and publish to anywhere with its versatile configuration, a powerful plugin
system, and hooks to execute any command you need to test, build, and/or publish your project.

[![Action Status][11]][10] [![npm version][13]][12]

Are you using release-it at work? Please consider [sponsoring me][14]!

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
    "release-it": "^19.0.0"
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

## Yarn & pnpm

- Using Yarn? Please see the [npm section on Yarn][15].
- Using pnpm? Please see [release-it-pnpm][16].

## Monorepos

Using a monorepo? Please see this [monorepo recipe][17].

## Global Installation

Per-project installation as shown above is recommended, but global installs are supported as well:

- From npm: `npm install -g release-it`
- From Homebrew: `brew install release-it`

## Containerized

Use [Release It! - Containerized][18] to run it in any environment as a standardized container without the need for a
Node environment. Thanks [Juan Carlos][19]!

## Videos, articles & examples

Here's a list of interesting external resources:

- Video: [How to use GitHub Actions & Release-It to Easily Release Your Code][20]
- Article: [Monorepo Semantic Releases][21] ([repo][22])

Want to add yours to the list? Just open a pull request!

## Configuration

Out of the box, release-it has sane defaults, and [plenty of options][23] to configure it. Most projects use a
`.release-it.json` file in the project root, or a `release-it` property in `package.json`.

Here's a quick example `.release-it.json`:

```json
{
  "$schema": "https://unpkg.com/release-it@19/schema/release-it.json",
  "git": {
    "commitMessage": "chore: release v${version}"
  },
  "github": {
    "release": true
  }
}
```

→ See [Configuration][24] for more details.

## Interactive vs. CI mode

By default, release-it is **interactive** and allows you to confirm each task before execution:

<img src="./docs/assets/release-it-interactive.gif?raw=true" height="290" />

By using the `--ci` option, the process is fully automated without prompts. The configured tasks will be executed as
demonstrated in the first animation above. In a Continuous Integration (CI) environment, this non-interactive mode is
activated automatically.

Use `--only-version` to use a prompt only to determine the version, and automate the rest.

## Latest version

How does release-it determine the latest version?

1. For projects with a `package.json`, its `version` will be used (see [npm][25] to skip this).
2. Otherwise, release-it uses the latest Git tag to determine which version should be released.
3. As a last resort, `0.0.0` will be used as the latest version.

Alternatively, a plugin can be used to override this (e.g. to manage a `VERSION` or `composer.json` file):

- [@release-it/bumper][26] to read from or bump the version in any file
- [@release-it/conventional-changelog][27] to get a recommended bump based on commit messages
- [release-it-calver-plugin][28] to use CalVer (Calendar Versioning)

Add the `--release-version` flag to print the **next** version without releasing anything.

## Git

Git projects are supported well by release-it, automating the tasks to stage, commit, tag and push releases to any Git
remote.

→ See [Git][29] for more details.

## npmjs.com Releases

As of July 2025, GitHub and GitLab CI workflows can now use npm's [Trusted Publishing][30] OpenID Connect (OIDC)
integration for secure, token-free publishing from CI/CD. This eliminates long-lived tokens and automatically generates
provenance attestations. See [docs/npm.md][31] for details.

## GitHub Releases

GitHub projects can have releases attached to Git tags, containing release notes and assets. There are two ways to add
[GitHub releases][32] in your release-it flow:

1. Automated (requires a `GITHUB_TOKEN`)
2. Manual (using the GitHub web interface with pre-populated fields)

→ See [GitHub Releases][33] for more details.

## GitLab Releases

GitLab projects can have releases attached to Git tags, containing release notes and assets. To automate [GitLab
releases][34]:

- Configure `gitlab.release: true`
- Obtain a [personal access token][35] (release-it needs the `api` and `self_rotate` scopes).
- Make sure the token is [available as an environment variable][36].

→ See [GitLab Releases][37] for more details.

## Changelog

By default, release-it generates a changelog, to show and help select a version for the new release. Additionally, this
changelog serves as the release notes for the GitHub or GitLab release.

The [default command][23] is based on `git log ...`. This setting (`git.changelog`) can be overridden. To further
customize the release notes for the GitHub or GitLab release, there's `github.releaseNotes` or `gitlab.releaseNotes`.
Make sure any of these commands output the changelog to `stdout`. Note that release-it by default is agnostic to commit
message conventions. Plugins are available for:

- GitHub and GitLab Releases
- auto-changelog
- Conventional Changelog
- Keep A Changelog
- git-cliff

To print the changelog without releasing anything, add the `--changelog` flag.

→ See [Changelog][38] for more details.

## Publish to npm

With a `package.json` in the current directory, release-it will let `npm` bump the version in `package.json` (and
`package-lock.json` if present), and publish to the npm registry.

→ See [Publish to npm][25] for more details.

## Manage pre-releases

With release-it, it's easy to create pre-releases: a version of your software that you want to make available, while
it's not in the stable semver range yet. Often "alpha", "beta", and "rc" (release candidate) are used as identifiers for
pre-releases. An example pre-release version is `2.0.0-beta.0`.

→ See [Manage pre-releases][39] for more details.

## Update or re-run existing releases

Use `--no-increment` to not increment the last version, but update the last existing tag/version.

This may be helpful in cases where the version was already incremented. Here are a few example scenarios:

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
be executed (e.g. `git.push: false`). See [execution order][40] for more details on execution order of plugin lifecycle
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

The variables can be found in the [default configuration][23]. Additionally, the following variables are exposed:

```text
version
latestVersion
changelog
name
repo.remote, repo.protocol, repo.host, repo.owner, repo.repository, repo.project
branchName
releaseUrl
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

→ See [Dry Runs][41] for more details.

## Troubleshooting & debugging

- With `release-it --verbose` (or `-V`), release-it prints the output of every user-defined [hook][2].
- With `release-it -VV`, release-it also prints the output of every internal command.
- Use `NODE_DEBUG=release-it:* release-it [...]` to print configuration and more error details.

Use `verbose: 2` in a configuration file to have the equivalent of `-VV` on the command line.

## Plugins

Since v11, release-it can be extended in many, many ways. Here are some plugins:

| Plugin                                    | Description                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| [@release-it/bumper][26]                  | Read & write the version from/to any file                                                   |
| [@release-it/conventional-changelog][27]  | Provides recommended bump, conventional-changelog, and updates `CHANGELOG.md`               |
| [@release-it/keep-a-changelog][42]        | Maintain CHANGELOG.md using the Keep a Changelog standards                                  |
| [@release-it-plugins/lerna-changelog][43] | Integrates lerna-changelog into the release-it pipeline                                     |
| [@jcamp-code/release-it-changelogen][44]  | Use [@unjs/changelogen][45] for versioning and changelog                                    |
| [@release-it-plugins/workspaces][46]      | Releases each of your projects configured workspaces                                        |
| [release-it-calver-plugin][28]            | Enables Calendar Versioning (calver) with release-it                                        |
| [@grupoboticario/news-fragments][47]      | An easy way to generate your changelog file                                                 |
| [@j-ulrich/release-it-regex-bumper][48]   | Regular expression based version read/write plugin for release-it                           |
| [@jcamp-code/release-it-dotnet][49]       | Use .csproj or .props file for versioning, automate NuGet publishing                        |
| [release-it-pnpm][16]                     | Add basic support for pnpm workspaces, integrates with [bumpp][50] and [changelogithub][51] |
| [changesets-release-it-plugin][52]        | Combine [Changesets][53] changelog management with release-it                               |
| [release-it-gitea][54]                    | Gitea plugin to create Gitea releases and upload attachments                                |
| [release-it-beautiful-changelog][84]      | Generate beautiful changelogs using conventional commits by [@unjs/changelogen][45]         |

Internally, release-it uses its own plugin architecture (for Git, GitHub, GitLab, npm).

→ See all [release-it plugins on npm][55].

→ See [plugins][56] for documentation to write plugins.

## Use release-it programmatically

While mostly used as a CLI tool, release-it can be used as a dependency to integrate in your own scripts. See [use
release-it programmatically][57] for example code.

## Projects using release-it

- [AdonisJs][58]
- [Axios][59]
- [Chakra UI][60]
- [Halo][61]
- [hosts][62]
- [js-cookie][63]
- [jQuery][64]
- [Madge][65]
- [Metalsmith][66]
- [n8n][67]
- [Node-Redis][68]
- [React Native Paper][69]
- [Readability.js][70]
- [Redux][71]
- [Saleor][72]
- [Semantic UI React][73]
- [tabler-icons][74]
- Swagger ([swagger-ui][75] + [swagger-editor][76])
- [Repositories that depend on release-it][77]
- GitHub search for [path:\*\*/.release-it.json][78]

## Node.js version support

The latest major version is v19, supporting Node.js 20 and up:

| release-it | Node.js |
| :--------: | :-----: |
|    v19     |   v20   |
|    v18     |   v20   |
|    v17     |   v18   |
|    v16     |   v16   |
|    v15     |   v14   |

Also see [CHANGELOG.md][79] for dates and details.

## Links

- See [CHANGELOG.md][79] for major/breaking updates, and [releases][80] for a detailed version history.
- To **contribute**, please read [CONTRIBUTING.md][81] first.
- Please [open an issue][82] if anything is missing or unclear in this documentation.

## License

[MIT][83]

Are you using release-it at work? Please consider [sponsoring me][14]!

[1]: #git
[2]: #hooks
[3]: #github-releases
[4]: #gitlab-releases
[5]: #changelog
[6]: #publish-to-npm
[7]: #manage-pre-releases
[8]: #plugins
[9]: ./docs/ci.md
[10]: https://github.com/release-it/release-it/actions
[11]: https://github.com/release-it/release-it/workflows/Cross-OS%20Tests/badge.svg
[12]: https://www.npmjs.com/package/release-it
[13]: https://badge.fury.io/js/release-it.svg
[14]: https://github.com/sponsors/webpro
[15]: ./docs/npm.md#yarn
[16]: https://github.com/hyoban/release-it-pnpm
[17]: ./docs/recipes/monorepo.md
[18]: https://github.com/juancarlosjr97/release-it-containerized
[19]: https://github.com/juancarlosjr97
[20]: https://www.youtube.com/watch?v=7pBcuT7j_A0
[21]: https://medium.com/valtech-ch/monorepo-semantic-releases-db114811efa5
[22]: https://github.com/b12k/monorepo-semantic-releases
[23]: ./config/release-it.json
[24]: ./docs/configuration.md
[25]: ./docs/npm.md
[26]: https://github.com/release-it/bumper
[27]: https://github.com/release-it/conventional-changelog
[28]: https://github.com/casmith/release-it-calver-plugin
[29]: ./docs/git.md
[30]: https://docs.npmjs.com/trusted-publishers
[31]: ./docs/npm.md#trusted-publishing-oidc
[32]: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
[33]: ./docs/github-releases.md
[34]: https://docs.gitlab.com/api/releases/
[35]: https://gitlab.com/profile/personal_access_tokens
[36]: ./docs/environment-variables.md
[37]: ./docs/gitlab-releases.md
[38]: ./docs/changelog.md
[39]: ./docs/pre-releases.md
[40]: ./docs/plugins.md#execution-order
[41]: ./docs/dry-runs.md
[42]: https://github.com/release-it/keep-a-changelog
[43]: https://github.com/release-it-plugins/lerna-changelog
[44]: https://github.com/jcamp-code/release-it-changelogen
[45]: https://github.com/unjs/changelogen
[46]: https://github.com/release-it-plugins/workspaces
[47]: https://github.com/grupoboticario/news-fragments
[48]: https://github.com/j-ulrich/release-it-regex-bumper
[49]: https://github.com/jcamp-code/release-it-dotnet
[50]: https://github.com/antfu/bumpp
[51]: https://github.com/antfu/changelogithub
[52]: https://www.npmjs.com/package/changesets-release-it-plugin
[53]: https://github.com/changesets/changesets
[54]: https://github.com/lib-pack/release-it-gitea
[55]: https://www.npmjs.com/search?q=keywords:release-it-plugin
[56]: ./docs/plugins.md
[57]: ./docs/recipes/programmatic.md
[58]: https://github.com/adonisjs/core
[59]: https://github.com/axios/axios
[60]: https://github.com/chakra-ui/chakra-ui
[61]: https://github.com/halo-dev/halo
[62]: https://github.com/StevenBlack/hosts
[63]: https://github.com/js-cookie/js-cookie
[64]: https://github.com/jquery/jquery
[65]: https://github.com/pahen/madge
[66]: https://github.com/metalsmith/metalsmith
[67]: https://github.com/n8n-io/n8n
[68]: https://github.com/redis/node-redis
[69]: https://github.com/callstack/react-native-paper
[70]: https://github.com/mozilla/readability
[71]: https://github.com/reduxjs/redux
[72]: https://github.com/saleor/saleor
[73]: https://github.com/Semantic-Org/Semantic-UI-React
[74]: https://github.com/tabler/tabler-icons
[75]: https://github.com/swagger-api/swagger-ui
[76]: https://github.com/swagger-api/swagger-editor
[77]: https://github.com/release-it/release-it/network/dependents
[78]: https://github.com/search?q=path%3A**%2F.release-it.json&type=code
[79]: ./CHANGELOG.md
[80]: https://github.com/release-it/release-it/releases
[81]: ./.github/CONTRIBUTING.md
[82]: https://github.com/release-it/release-it/issues/new
[83]: ./LICENSE
[84]: https://github.com/mohammadGh/release-it-beautiful-changelog
