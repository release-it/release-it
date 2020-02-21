## Changelog

By default, release-it generates a changelog, to show and help select a version for the new release. Additionally, this
changelog serves as the release notes for the GitHub or GitLab release.

The [default command](../config/release-it.json) is based on `git log ...`. This setting (`git.changelog`) can be
overridden. To customize the release notes for the GitHub or GitLab release, use `github.releaseNotes` or
`gitlab.releaseNotes`. Make sure any of these commands output the changelog to `stdout`.

Instead of executing a shell command, a (Handlebars) template can be used to generate the changelog. See
[auto-changelog](#auto-changelog) below for more details.

Some projects keep their changelog in e.g. `CHANGELOG.md` or `history.md`. To auto-update this file with the release,
the recommended configuration is to use a command that does this in `hooks.after:bump`. See below for examples and
workflows.

### Auto-changelog

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

With this `git.changelog`, the changelog preview is based on the `changelog-compact.hbs` template file. This would be
used for [GitHub](./github-releases.md) or [GitLab releases](./gitlab-releases.md) as well.

Additionally, `hooks.after:bump` will update the `CHANGELOG.md` with each release to get included with the release
commit. This can be omitted if the project does not keep a `CHANGELOG.md` or similar.

See the [auto-changelog recipe](./recipes/auto-changelog.md) for an example setup and template.

### Conventional Changelog

If your project follows conventions, such as the
[Angular commit guidelines](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#commits), the
[@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) plugin is useful.

```bash
npm install @release-it/conventional-changelog --save-dev
```

Use this plugin to get the recommended bump based on the commit messages, generate a conventional changelog, and update
the `CHANGELOG.md` file:

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

- Omit the `infile` at will. If set, but the file does not exist yet, it's created with the full history.
- Please find the
  [list of available presets](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages)
  (`angular`, `ember`, etc).
- The options are sent verbatim to
  [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog/README.md).
