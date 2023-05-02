# Changelog

By default, release-it generates a changelog, to show and help select a version for the new release. It contains all
commits since the latest tag.

The [default command][1] is based on `git log ...`. This setting (`git.changelog`) can be overridden. Make sure any of
these commands output the changelog to `stdout`.

- [GitHub and GitLab Releases][2]
- [auto-changelog][3]
- [Conventional Changelog][4]
- [Keep A Changelog][5]

Some projects keep their changelog in e.g. `CHANGELOG.md` or `history.md`. To auto-update this file and include this in
the release commit, the recommended configuration is to do this in the `after:bump` hook (see example below).

## GitHub and GitLab Releases

The output of `git.changelog` also serves as the release notes for the [GitHub][6] or [GitLab release][7]. To customize
the release notes for the GitHub or GitLab release, use `github.releaseNotes` or `gitlab.releaseNotes`. Make sure any of
these commands output the changelog to `stdout`.

## Auto-changelog

For a more rich changelog (e.g. with headers, sections), a (Handlebars) template can be used to generate the changelog.
For this, [auto-changelog][8] is a great companion to release-it:

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

See the [auto-changelog recipe][9] for an example setup and template.

## Conventional Changelog

If your project follows conventions, such as the [Angular commit guidelines][10], the
[@release-it/conventional-changelog][11] plugin is useful.

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

If your project follows the [Keep a Changelog][12] conventions, the [@release-it/keep-a-changelog][13] plugin is useful.
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

[1]: ../config/release-it.json
[2]: #github-and-gitlab-releases
[3]: #auto-changelog
[4]: #conventional-changelog
[5]: #keep-a-changelog
[6]: ./github-releases.md
[7]: ./gitlab-releases.md
[8]: https://github.com/CookPete/auto-changelog
[9]: ./recipes/auto-changelog.md
[10]: https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits
[11]: https://github.com/release-it/conventional-changelog
[12]: https://keepachangelog.com
[13]: https://github.com/release-it/keep-a-changelog
