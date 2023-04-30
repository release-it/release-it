# Monorepo

Although release-it was not originally designed for monorepos, certain workflows with multiple workspaces can still be
installed.

If all workspaces should be bumped to the same version and are published at the same time, then follow the two steps in
this guide.

- A single `npm run release` to publish each package, finishing with a run for the monorepo root.
- Each package will be published one after another separately.
- The `version` in each `package.json` will be bumped.
- All internal packages in `dependencies` and `devDependencies` will be bumped to the same version.

There is nothing fancy going on, this works with existing solutions. I did not test this with the conventional-changelog
plugin. Currently using this setup myself in the [7-docs][1] monorepo. See [this commit][2] that follows this guide.

## 1. Configure root/monorepo

- Install the bumper plugin: `npm install -D @release-it/bumper`
- Order the `workspaces` so a workspace depending on another comes after it. See the examples below.
- Add a `release` script to run the `release` script of all workspaces and end with itself.
- Make sure it contains `git.requireCleanWorkingDir: false` (to include all updated `package.json` files)
- Make sure to add `npm.publish: false` here if the root should not be published.
- Add e.g. `github.release: true` and/or other changelog related tasks to the root config.

Example:

```json
{
  "name": "root-package",
  "version": "1.0.0",
  "workspaces": ["packages/a", "packages/b", "packages/c"],
  "scripts": {
    "release": "npm run release --workspaces && release-it"
  },
  "release-it": {
    "git": {
      "requireCleanWorkingDir": false
    }
  }
}
```

## 2. Configure each workspace

- Add a `"release": "release-it"` script to each workspace's `package.json`.
- Add a `release-it` config (either to `package.json` or in `.release-it.json`)
- Make sure it contains `git: false`
- Add `@release-it/bumper` config if it has internal dependencies so these `dependencies` or `devDependencies` will be
  automatically bumped during the release-it process.

### Without internal dependencies

Example for a workspace without internal dependencies:

```json
{
  "name": "package-a",
  "version": "1.0.0",
  "scripts": {
    "release": "release-it"
  },
  "dependencies": {},
  "release-it": {
    "git": false
  }
}
```

### With internal dependencies

Example for a workspace with internal dependencies:

```json
{
  "name": "package-c",
  "version": "1.0.0",
  "scripts": {
    "release": "release-it"
  },
  "dependencies": {
    "package-a": "1.0.0"
  },
  "devDependencies": {
    "package-b": "1.0.0"
  },
  "release-it": {
    "git": false,
    "plugins": {
      "@release-it/bumper": {
        "out": {
          "file": "package.json",
          "path": ["dependencies.package-a", "devDependencies.package-b"]
        }
      }
    }
  }
}
```

[1]: https://github.com/7-docs/7-docs
[2]: https://github.com/7-docs/7-docs/commit/128df8b8f3b39f0e5e27edf4fb0a1a732300ddbc
