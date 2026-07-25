# Git-cliff

Please refer to [git-cliff documentation][1] for more details and usage.

## Config

Add git-cliff to the project:

```bash
npm install --save-dev git-cliff
```

The `git.changelog` command runs before the version is selected, so it should render the unreleased changes. Once the
version is selected, `${version}` is available to hooks and release note commands:

```json
{
  "git": {
    "changelog": "npm exec -- git-cliff --unreleased"
  },
  "hooks": {
    "after:bump": "npm exec -- git-cliff --output CHANGELOG.md --tag ${version}"
  },
  "github": {
    "releaseNotes": "npm exec -- git-cliff --output - --unreleased --tag ${version}"
  }
}
```

The `github.releaseNotes` command is needed when the GitHub release should contain the final version heading. Otherwise,
release-it reuses the initial changelog output. Use `gitlab.releaseNotes` instead when publishing a GitLab release.

## Template

Git-cliff uses Tera as a templating language, which is inspired by Jinja2 and Django templates.

See [git-cliff syntax docs][2] for more information.

## Monorepos

Git-cliff has a `--include-path` flag to scope changes to a specific directory path.

See [git-cliff monorepo docs][3] for more information.

[1]: https://github.com/orhun/git-cliff
[2]: https://git-cliff.org/docs/templating/examples
[3]: https://git-cliff.org/docs/usage/monorepos
