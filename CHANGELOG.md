# Changelog

This document lists breaking changes for each major release.

See the GitHub Releases page for detailed changelogs:
[https://github.com/release-it/release-it/releases](https://github.com/release-it/release-it/releases)

## v13

- Dropped support for Node v8
- Dropped support for GitLab v11.6 and lower.
- Deprecated `scripts` are removed (in favor of [hooks](https://github.com/release-it/release-it#hooks)).
- Removed deprecated `--non-interactive` (`-n`) argument. Use `--ci` instead.
- Removed old `%s` and `[REV_RANGE]` syntax in command substitutions. Use `${version}` and `${latestTag}` instead.

## v12

- The `--follow-tags` argument for `git push` has been moved to the default configuration. This is only a breaking
  change if `git.pushArgs` was not empty (it was empty by default).

## v11

- The custom `conventional-changelog` increment (e.g. `"increment": "conventional:angular"`) with additional script
  configuration is replaced with a plugin. Please see
  [conventional changelog](https://github.com/release-it/release-it/blob/master/docs/changelog.md#conventional-changelog)
  how to use this plugin.
- The `pkgFiles` option has been removed. If there's a need to bump other files than what `npm version` bumps, it should
  be (part of) a plugin.
- By default, the latest version was derived from the latest Git tag. From v11, if the repo has a `package.json` then
  that `version` is used instead. The `use` option has been removed. Also see
  [latest version](https://github.com/release-it/release-it#latest-version).
- `scripts.changelog` has been moved to `git.changelog`

## v10

- Dropped support for Node v6
- Deprecated options from v9 are removed, the `dist.repo` config in particular (also see
  [distribution repository](https://github.com/release-it/release-it/blob/master/docs/recipes/distribution-repo.md) for
  alternatives).
- Drop the `--debug` flag. `DEBUG=release-it:* ...` still works.

## v9

There should be no breaking changes, but there have been major internal refactorings and an improved UI. A bunch of new
features and bug fixes have been implemented. Last but not least, the configuration structure is changed significantly.
For this (backwards compatible) change, deprecation warnings are shown, and configurations must be migrated with the
next major release (v10). See [deprecated.json](./config/deprecated.json) for the changes, mainly:

- All "command hooks" have been moved to `scripts.*`, and some have been renamed.
- All `src.*` options have been moved to `git.*` (and `scripts.*`).
- The `dist.repo` configuration and functionality has been removed.

## v8

- Drop the `--force` flag. It's only use was to move a Git tag.

## v7

- No longer adds untracked files to release commit. (#230)

## v6

- Default value for `requireCleanWorkingDir` is now `true` (previously: `false`). (#173)
- Skip prompt (interactive) if corresponding task (non-interactive) is disabled. E.g. `npm.publish: false` will also not
  show "publish" prompt.

## v5

- Drop support for Node v4.

[Release notes for v5](https://github.com/release-it/release-it/releases/tag/5.0.0-beta.0)

## v4

- Use `shell.exec` for build commands by default (previously this required a `!` prefix).

[Release notes for v4](https://github.com/release-it/release-it/releases/tag/4.0.0-rc.0)

## v3

- Configuration filename must be `.release-it.json` (previously `.release.json`).
- Refactored configuration structure in this file (and the CLI arguments with it).

[Release notes for v3](https://github.com/release-it/release-it/releases/tag/3.0.0)

## v2

- Build command is executed before git commit/push.
- Configuration options are better organized. Most of them are backwards compatible with a deprecation notice.

[Release notes for v2](https://github.com/release-it/release-it/releases/tag/2.0.0)

## v1

Initial major release.

[Release notes for v1](https://github.com/release-it/release-it/releases/tag/1.0.0)
