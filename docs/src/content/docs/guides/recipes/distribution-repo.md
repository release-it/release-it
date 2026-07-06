---
title: Distribution repository recipe
description: Publish generated files from release-it to a separate distribution repository or branch (like gh-pages) using hooks.
sidebar:
  label: Distribution repo
  order: 5
---

Some projects publish generated files (compiled assets, documentation, distribution builds) to
a separate repository or branch — see [shim repositories](https://github.com/components) or
the [packaged Angular.js repository](https://github.com/angular/bower-angular) for classic
examples.

The old `dist.repo` setting was deprecated in
[v9.8.0](https://github.com/release-it/release-it/releases/tag/9.8.0) and removed in v10, but
the workflow is still achievable via hooks. Two starting points below.

## Separate distribution repo

Relies on [`npm version`](https://docs.npmjs.com/cli/version.html).

Source repo's `.release-it.json`:

```json
{
  "hooks": {
    "before:init": "git clone https://github.com/example/dist-repo .stage",
    "after:release": "cd .stage && npm version ${version} && cd -"
  }
}
```

Dist repo's `package.json`:

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

- Clones the dist repo into `./.stage`.
- Runs `npm version`, which triggers the dist repo's `version` and `postversion` scripts.

## Distribution branch in the same repo

A single repo with a `dist` (or `gh-pages`) branch. In `package.json`:

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

- Clones the repo (checking out the `dist` branch) into `./.stage`.
- Runs the build so distribution files land inside `./.stage`.
- Commits and pushes the branch back to origin.
