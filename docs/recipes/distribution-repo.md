# Distribution repository

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

With this example:

- The `dist.repo` will be cloned to `.stage`.
- From the root of source repo, `npm run build` is executed.
- All generated files in `dist` (matching with `dist/**/*`) will be copied over to the `.stage` directory.
- The result is pushed back to `dist.repo`.
- A GitHub release is created from the source repo.
- The package is published to npm from the distribution repo.
