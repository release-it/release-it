# Distribution repository

Some projects use a distribution repository. Generated files (such as compiled assets or documentation) can be
distributed to a separate repository. Or to a separate branch, such as a `gh-pages`. Some examples include [shim
repositories][1] and a separate [packaged Angular.js repository][2] for distribution on npm and Bower.

The `dist.repo` setting is deprecated since [v9.8.0][3], and removed in v10. However, publishing a seperate distribution
can still be achieved. There are many solutions to this, here are some basic examples for inspiration.

## Separate distribution repo

This technique is largely depending on [npm-version][4].

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

[1]: https://github.com/components
[2]: https://github.com/angular/bower-angular
[3]: https://github.com/release-it/release-it/releases/tag/9.8.0
[4]: https://docs.npmjs.com/cli/version.html
