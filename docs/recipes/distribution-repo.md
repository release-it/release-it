# Distribution repository

The `dist.repo` setting is deprecated since [v9.8.0](https://github.com/release-it/release-it/releases/tag/9.8.0), and
removed in v10. However, publishing a seperate distribution can still be achieved. There are many solutions to this,
here are some basic examples for inspiration.

## Separate distribution repo

This technique is largely depending on [npm-version](https://docs.npmjs.com/cli/version.html).

In `.release-it.json` of the source repo:

```json
{
  "hooks": {
    "before:init": "git clone https://github.com/example/dist-repo .stage",
    "after:release": "cd .stage && npm version ${version} && cd -"
  }
}
```

In `package.json` of dist repo:

```json
{
  "name": "my-dist-package",
  "version": "1.0.0",
  "scripts": {
    "version": "echo copy ../dist/files > ./files && git add . --all",
    "postversion": "git push --follow-tags"
  }
}
```

- Clones the dist repo to `./.stage`.
- Runs `npm version`, which automatically runs the `version` and `postversion` scripts.

## Distribution branch in same repo

A single repository, with e.g. a `dist` or `gh-pages` branch. In `package.json`:

```json
{
  "name": "my-package",
  "version": "1.0.0",
  "release-it": {
    "npm": {
      "publish": false
    },
    "hooks": {
      "before:init": "git clone https://github.com/my/my-package -b dist .stage",
      "before:release": "npm run build",
      "after:release": "cd .stage && git add . --all && git commit -m 'Updated!' && git push && cd -"
    }
  }
}
```

- Clone itself to `./.stage` while checking out the `dist` branch.
- Execute `npm run build` to generate distribution files (into `./.stage`)
- Stage all files, commit and push back to origin.
