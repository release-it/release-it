---
title: Installation
description: Install release-it in a Node.js project, globally, from Homebrew, or as a container.
---

release-it works best when installed per-project as a `devDependency`, so every collaborator (and
your CI) runs the exact same version.

## Recommended: scaffold in an existing project

The `create` initializer installs release-it, adds a `release` script, and drops a minimal
`.release-it.json` in your project root:

```bash
npm init release-it
```

## Install manually

If you'd rather set things up by hand:

```bash
npm install --save-dev release-it
```

Then add a `release` script to `package.json`:

```json
{
  "name": "my-package",
  "version": "1.0.0",
  "scripts": {
    "release": "release-it"
  },
  "devDependencies": {
    "release-it": "^20.0.0"
  }
}
```

## Yarn & pnpm

- **Yarn** — See the [notes on Yarn in the npm guide](/release-it/guides/publishing/npm/#yarn).
- **pnpm** — Use the [`release-it-pnpm`](https://github.com/hyoban/release-it-pnpm) preset.

## Monorepos

Multiple packages in one repo? See the [Monorepo recipe](/release-it/guides/recipes/monorepo/).

## Global installation

Per-project is recommended, but a global install works too:

- From npm: `npm install -g release-it`
- From Homebrew: `brew install release-it`

## Containerized

To run release-it in any environment without provisioning Node,
[**Release It! – Containerized**](https://github.com/juancarlosjr97/release-it-containerized)
provides a ready-to-use Docker image.

## Node.js support

release-it v20 requires **Node.js 20.19.0** or later. Older release-it majors run on
earlier Node.js versions:

| release-it | Minimum Node.js |
| :--------- | :-------------- |
| **v20** _(current)_ | 20.19.0 |
| v19        | 20.12.0 |
| v18        | 20      |
| v17        | 18      |
| v16        | 16      |
| v15        | 14      |

See the [changelog](https://github.com/release-it/release-it/blob/main/CHANGELOG.md) for
release dates and breaking changes.

## Next step

Cut your first release — see [Your first release](/release-it/start/first-release/).
