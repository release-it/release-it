# Changelog

By default, release-it generates a changelog, to show and help select a version for the new release. It contains all
commits since the latest tag.

The [default command](../config/release-it.json) is based on `git log ...`. This setting (`git.changelog`) can be
overridden. Make sure any of these commands output the changelog to `stdout`.

For a more rich changelog (e.g. with headers, sections), a (Handlebars) template can be used to generate the changelog.
See [auto-changelog](#auto-changelog) below for more details.

Some projects keep their changelog in e.g. `CHANGELOG.md` or `history.md`. To auto-update this file and include this in
the release commit, the recommended configuration is to do this in the `after:bump` hook (see example below).

An alternative is to use the [conventional-changelog](#conventional-changelog) plugin for this.

## GitHub and GitLab Releases

The output of `git.changelog` also serves as the release notes for the [GitHub](./github-releases.md) or
[GitLab release](./gitlab-releases.md). To customize the release notes for the GitHub or GitLab release, use
`github.releaseNotes` or `gitlab.releaseNotes`. Make sure any of these commands output the changelog to `stdout`.

## Auto-changelog

A tool like [auto-changelog](https://github.com/CookPete/auto-changelog) is a great companion to release-it:

```json
{
  "git": {
    "changelog": "npx auto-changelog --stdout --commit-limit false -u --template https://raw.githubusercontent.com/release-it/release-it/master/config/changelog-compact.hbs"
  },
  "hooks": {
    "after:bump": "npx auto-changelog -p"
  }
}
```

With this `git.changelog`, the changelog preview is based on the `changelog-compact.hbs` template file.

Additionally, `hooks.after:bump` will update the `CHANGELOG.md` with each release to get included with the release
commit. This can be omitted if the project does not keep a `CHANGELOG.md` or similar.

See the [auto-changelog recipe](./recipes/auto-changelog.md) for an example setup and template.

## Conventional Changelog

If your project follows conventions, such as the
[Angular commit guidelines](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits), the
[@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) plugin is useful.

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

- Omit the `infile` to only use the recommended bump. If the file doesn't exist yet, it's created with the full history.
- Please find the
  [list of available presets](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages)
  (`angular`, `ember`, etc).
- The options are sent verbatim to
  [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog/README.md).
