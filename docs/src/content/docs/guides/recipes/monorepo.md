---
title: Monorepo recipe
description: Run release-it in a monorepo — bump every workspace to the same version, publish sequentially, and keep internal dependencies in sync via @release-it/bumper.
sidebar:
  label: Monorepo
  order: 4
---

release-it wasn't originally designed for monorepos, but if you want all workspaces to move to
the same version together, the two-step setup below works well.

- One `npm run release` publishes every workspace, ending with a run for the monorepo root.
- Each package publishes one after another.
- Every workspace's `package.json` version is bumped.
- All internal packages listed in `dependencies` / `devDependencies` are bumped to match.

There's nothing exotic here — it composes existing pieces. This is the same setup used in the
[7-docs](https://github.com/7-docs/7-docs) monorepo
([example commit](https://github.com/7-docs/7-docs/commit/128df8b8f3b39f0e5e27edf4fb0a1a732300ddbc)).
It has _not_ been tested against
[@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog).

## 1. Configure the monorepo root

- Install the bumper plugin: `npm install --save-dev @release-it/bumper`.
- Order `workspaces` so a workspace depending on another comes _after_ its dependency.
- Add a `release` script that iterates all workspaces and ends with itself.
- Set `git.requireCleanWorkingDir: false` — the child releases will have modified their own
  `package.json` files by the time the root runs.
- If the root shouldn't publish, add `npm.publish: false`.
- Add `github.release: true` (or your changelog config) to the root.

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

- Add a `"release": "release-it"` script.
- Add a release-it config (in `package.json` or `.release-it.json`).
- Set `git: false` — Git only runs from the monorepo root.
- If the workspace has internal deps, add
  [@release-it/bumper](https://github.com/release-it/bumper) so its versions stay in sync.

### Without internal dependencies

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
