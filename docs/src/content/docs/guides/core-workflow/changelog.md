---
title: Changelog
description: Generate a changelog with release-it — either from git log, or via auto-changelog, Conventional Changelog, Keep A Changelog, or git-cliff plugins.
---

release-it always generates a changelog when it boots — it doubles as the version-selection
preview and, when configured, as the release notes for [GitHub](/release-it/guides/publishing/github-releases/)
or [GitLab](/release-it/guides/publishing/gitlab-releases/) releases.

The [default `git.changelog`
command](https://github.com/release-it/release-it/blob/main/config/release-it.json) is a plain
`git log …`. Override it with anything that prints to `stdout`.

## Print without releasing

```bash
release-it --changelog
```

## Silence long previews

Very active projects can drown in changelog output. Suppress the preview blocks (changelog,
changeset, release notes) with:

```json
{
  "quiet": true
}
```

Or on the command line: `release-it --quiet`. A single notice is still printed so it's clear
that previews were hidden. `--changelog` mode isn't affected.

## What feeds the GitHub / GitLab release notes?

By default, whatever `git.changelog` prints. Override per platform with
[`github.releaseNotes`](/release-it/guides/publishing/github-releases/#release-notes) or
[`gitlab.releaseNotes`](/release-it/guides/publishing/gitlab-releases/#release-notes).

## Companion tools & plugins

### auto-changelog

For a richer, sectioned changelog, [auto-changelog](https://github.com/CookPete/auto-changelog)
pairs well with release-it:

```json
{
  "git": {
    "changelog": "npx auto-changelog --stdout --commit-limit false -u --template https://raw.githubusercontent.com/release-it/release-it/main/templates/changelog-compact.hbs"
  },
  "hooks": {
    "after:bump": "npx auto-changelog -p"
  }
}
```

The `git.changelog` command drives the preview; the `after:bump` hook updates `CHANGELOG.md`
so it gets included in the release commit. Drop the second line if you don't keep a file
changelog.

See the [full recipe](/release-it/guides/recipes/auto-changelog/) for template details.

### Conventional Changelog

If you follow [Angular commit
conventions](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits) (or any
[preset](https://github.com/conventional-changelog/conventional-changelog#presets)), the
[@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog)
plugin recommends bumps and updates `CHANGELOG.md`:

```bash
npm install --save-dev @release-it/conventional-changelog
```

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

### Keep a Changelog

If you maintain a [Keep a Changelog](https://keepachangelog.com)–style file, use
[@release-it/keep-a-changelog](https://github.com/release-it/keep-a-changelog):

```bash
npm install --save-dev @release-it/keep-a-changelog
```

```json
{
  "plugins": {
    "@release-it/keep-a-changelog": {
      "filename": "CHANGELOG.md"
    }
  }
}
```

### git-cliff

For a Tera-templated Conventional-Commits changelog, see the
[git-cliff recipe](/release-it/guides/recipes/git-cliff/).
