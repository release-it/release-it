# Changelog

By default, release-it generates a changelog, to show and help select a version for the new release. It contains all
commits since the latest tag.

The [default command][1] is based on `git log ...`. This setting (`git.changelog`) can be overridden. Make sure any of
these commands output the changelog to `stdout`.

- [GitHub and GitLab Releases][2]
- [auto-changelog][3]
- [Conventional Changelog][4]
- [Keep A Changelog][5]
- [git-cliff][6]

Some projects keep their changelog in e.g. `CHANGELOG.md` or `history.md`. To auto-update this file and include this in
the release commit, the recommended configuration is to do this in the `after:bump` hook (see example below).

## GitHub and GitLab Releases

The output of `git.changelog` also serves as the release notes for the [GitHub][7] or [GitLab release][8]. To customize
the release notes for the GitHub or GitLab release, use `github.releaseNotes` or `gitlab.releaseNotes`. Make sure any of
these commands output the changelog to `stdout`.

## Auto-changelog

For a more rich changelog (e.g. with headers, sections), a (Handlebars) template can be used to generate the changelog.
For this, [auto-changelog][9] is a great companion to release-it:

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

With this `git.changelog`, the changelog preview is based on the `changelog-compact.hbs` template file.

Additionally, `hooks.after:bump` will update the `CHANGELOG.md` with each release to get included with the release
commit. This can be omitted if the project does not keep a `CHANGELOG.md` or similar.

See the [auto-changelog recipe][10] for an example setup and template.

## Conventional Changelog

If your project follows conventions, such as the [Angular commit guidelines][11], the
[@release-it/conventional-changelog][12] plugin is useful.

```bash
npm install @release-it/conventional-changelog --save-dev
```

Use this plugin to get the recommended bump based on the commit messages.

Additionally, it can generate a conventional changelog, and optionally update the `CHANGELOG.md` file in the process.

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

## Keep A Changelog

If your project follows the [Keep a Changelog][13] conventions, the [@release-it/keep-a-changelog][14] plugin is useful.
It updates the `CHANGELOG.md` file according to the convention of using human-readable items and an "Unreleased"
section.

The GitHub releases section could then be used for either a copy of this changelog, or for a log of commits
(`github.releaseNotes: "git log ..."`).

```bash
npm install @release-it/keep-a-changelog --save-dev
```

This plugin updates `CHANGELOG.md` file according to

```json
{
  "plugins": {
    "@release-it/keep-a-changelog": {
      "filename": "CHANGELOG.md"
    }
  }
}
```

## Git-cliff

Git-cliff is a customizable changelog generator that follows Conventional Commit specifications. Similar to
auto-changelog, it can be used as a companion to release-it.

See the [git-cliff recipe][15] for an example setup.

[1]: ../config/release-it.json
[2]: #github-and-gitlab-releases
[3]: #auto-changelog
[4]: #conventional-changelog
[5]: #keep-a-changelog
[6]: https://github.com/orhun/git-cliff
[7]: ./github-releases.md
[8]: ./gitlab-releases.md
[9]: https://github.com/CookPete/auto-changelog
[10]: ./recipes/auto-changelog.md
[11]: https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits
[12]: https://github.com/release-it/conventional-changelog
[13]: https://keepachangelog.com
[14]: https://github.com/release-it/keep-a-changelog
[15]: ./recipes/git-cliff.md
