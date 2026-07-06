---
title: Plugin architecture
description: Why release-it is plugin-based, how the core plugins fit together, and how third-party plugins hook into the same lifecycle.
---

release-it is really just a small orchestrator around a set of **plugins**. If a task can be
written in Node.js or invoked from a shell, it can slot in.

## What plugins can do

- Publish the package to any registry (Ruby, Python, Rust, .NET — anything).
- Provide a different changelog / release-notes strategy.
- Trigger web hooks (Slack, Discord, custom notifiers).
- Use a different VCS — for example
  [@release-it/mercurial](https://github.com/release-it/mercurial).
- Use Node.js directly instead of shelling out via `hooks.*`.
- **Replace** existing plugins — say, talk to the npm registry via
  [libnpm](https://github.com/npm/libnpm) instead of shelling out to `npm publish`.

## Core plugins

release-it ships with five internal plugins, each of which self-enables:

- `git` — active when the current directory contains a `.git` folder.
- `github` — active when `github.release` is `true`.
- `gitlab` — active when `gitlab.release` is `true`.
- `npm` — active when `package.json` exists.
- `version` — always active (owns version increments and version prompts).

Every one of them uses exactly the same API third-party plugins do — the
[Plugin API reference](/release-it/reference/plugin-api/) covers the full surface.

## Adding a plugin

Configure the `plugins` object:

```json
{
  "plugins": {
    "release-it-plugin": { "key": "value" }
  }
}
```

Or point at a local file:

```json
{
  "plugins": {
    "./scripts/release-it-plugin.js": { "key": "value" }
  }
}
```

## Interacting with core plugins

Plugins interact via well-defined return values.

**Example.** A plugin that reads the version from a `./VERSION` file:

```js
class MyPlugin extends Plugin {
  getLatestVersion() {
    return fs.readFileSync('./VERSION', 'utf8').trim();
  }
  bump(version) {
    this.version = version;
    fs.writeFileSync('./VERSION', version);
  }
}
```

By implementing `getLatestVersion`, this plugin claims responsibility for _providing_ the
latest version. If the `npm` plugin is also enabled, it now bumps `package.json` using the
value this plugin returned. If the `git` plugin is also enabled, its `beforeRelease` stages the
updated `./VERSION` file so it lands in the release commit.

That's the whole model: each plugin returns what it knows, and release-it orchestrates the
rest. Order matters — see [Execution order](/release-it/explanations/execution-order/).

## Where to see more

- Full [Plugin API reference](/release-it/reference/plugin-api/).
- End-to-end [Custom version plugin
  recipe](/release-it/guides/recipes/custom-version-plugin/).
- The full list of [community plugins](/release-it/reference/community-plugins/) on npm.
- The internal
  [core plugin sources](https://github.com/release-it/release-it/tree/main/lib/plugin).
