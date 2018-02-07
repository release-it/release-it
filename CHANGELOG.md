# Changelog

This document lists breaking changes for each major release.

See the GitHub Releases page for detailed changelogs: [https://github.com/webpro/release-it/releases](https://github.com/webpro/release-it/releases)

## v7

* No longer adds untracked files to release commit. (#230)

## v6

* Default value for `requireCleanWorkingDir` is now `true` (previously: `false`). (#173)
* Skip prompt (interactive) if corresponding task (non-interactive) is disabled.
  E.g. `npm.publish: false` will also not show "publish" prompt.

## v5

* Drop support for Node v4.

[Release notes for v5](https://github.com/webpro/release-it/releases/tag/5.0.0-beta.0)

## v4

* Use `shell.exec` for build commands by default (previously this required a `!` prefix).

[Release notes for v4](https://github.com/webpro/release-it/releases/tag/4.0.0-rc.0)

## v3

* Configuration filename must be `.release-it.json` (previously `.release.json`).
* Refactored configuration structure in this file (and the CLI arguments with it).

[Release notes for v3](https://github.com/webpro/release-it/releases/tag/3.0.0)

## v2

* Build command is executed before git commit/push.
* Configuration options are better organized. Most of them are backwards compatible with a deprecation notice.

[Release notes for v2](https://github.com/webpro/release-it/releases/tag/2.0.0)

## v1

Initial major release.

[Release notes for v1](https://github.com/webpro/release-it/releases/tag/1.0.0)
