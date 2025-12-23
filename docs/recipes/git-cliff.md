# Git-cliff

Please refer to [git-cliff documentation][1] for more details and usage.

## Config

Add git-cliff to the project:

```bash
npm install --save-dev git-cliff
```

Git-cliff has the ability to use the Conventional Commits convention to automatically set the package version.
Release-it allows the user to select the version that should be released. Therefore, it may be helpful to generate the
changelog from the version in the `package.json` that was bumped by release-it.

```sh
#!/usr/bin/env bash

NODE_VERSION=$(node -p -e "require('./package.json').version")

if [ "$1" = "stdout" ]; then
    npm exec git-cliff -o - --unreleased --tag $NODE_VERSION
else
    npm exec git-cliff -o './CHANGELOG.md' --tag $NODE_VERSION
fi
```

Example configuration in the release-it config:

```json
{
  "hooks": {
    "after:bump": "./changelog.sh"
  },
  "github": {
    "releaseNotes": "./changelog.sh stdout"
  }
}
```

## Template

Git-cliff uses Tera as a templating language, which is inspired by Jinja2 and Django templates.

See [git-cliff syntax docs][2] for more information.

## Monorepos

Git-cliff has a `--include-path` flag to scope changes to a specific directory path.

See [git-cliff monorepo docs][3] for more information.

[1]: https://github.com/orhun/git-cliff
[2]: https://git-cliff.org/docs/templating/examples
[3]: https://git-cliff.org/docs/usage/monorepos
