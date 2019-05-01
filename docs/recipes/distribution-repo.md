# Distribution repository

The `dist.repo` setting is deprecated since [v9.8.0](https://github.com/release-it/release-it/releases/tag/9.8.0), and
removed in v10. However, the idea can still be achieved. There are many solutions to this, here are some basic examples
for inspiration.

## Separate distribution repo

This technique is largely depending on [npm-version](https://docs.npmjs.com/cli/version.html).

In `.release-it.json` of the source repo:

```json
{
  "increment": "minor",
  "preRelease": "alpha",
  "git": { "tagName": "v${version}" },
  "scripts": {
    "beforeStart": "git clone https://github.com/example/dist-repo .stage",
    "afterRelease": "cd .stage && npm version ${version} && cd -"
  }
}
```

In `package.json` of dist repo:

```json
{
  "name": "my-dist-package",
  "version": "1.0.0",
  "scripts": {
    "version": "echo release-line >> dist-file && git add . --all",
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
    "increment": "minor",
    "git": { "tagName": "v${version}" },
    "npm": { "publish": false },
    "scripts": {
      "beforeStart": "git clone https://github.com/my/my-package -b dist .stage",
      "beforeStage": "npm run build",
      "afterRelease": "cd .stage && git add . --all && git commit -m 'Updated!' && git push && cd -"
    }
  }
}
```

- Clone itself to `./.stage` while checking out the `dist` branch.
- Execute `npm run build` to generate distribution files (into `./.stage`)
- Stage all files, commit and push back to origin.

## Deprecated (`dist.repo` config)

```json
{
  "scripts": {
    "beforeStage": "npm run build"
  },
  "github": {
    "release": true
  },
  "dist": {
    "repo": "git@github.com:components/ember.git",
    "stageDir": ".stage",
    "baseDir": "dist",
    "files": ["**/*"],
    "npm": {
      "publish": true
    }
  }
}
```

With this **deprecated** example:

- The `dist.repo` will be cloned to `.stage`.
- From the root of source repo, `npm run build` is executed.
- All generated files in `dist` (matching with `dist/**/*`) will be copied over to the `.stage` directory.
- The result is pushed back to `dist.repo`.
- A GitHub release is created from the source repo.
- The package is published to npm from the distribution repo.
