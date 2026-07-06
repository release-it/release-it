---
title: Plugin API
description: Complete reference of the release-it Plugin class — static, release-cycle, getter, and helper methods, plus registration and template variables.
---

Everything below documents the `Plugin` class exported from `release-it`. Extend it and
implement whichever release-cycle methods you need. Every method can be `async` (except
`disablePlugin`).

For a narrative introduction, see [Plugin
architecture](/release-it/explanations/plugin-architecture/). For an end-to-end example, see the
[Custom version plugin recipe](/release-it/guides/recipes/custom-version-plugin/).

## Registering a plugin

Plugins are local to the project or plain npm packages. Configure via the top-level `plugins`
object:

```json
{
  "devDependencies": {
    "release-it": "*",
    "release-it-plugin": "*"
  },
  "release-it": {
    "github": {
      "release": true
    },
    "plugins": {
      "release-it-plugin": {
        "key": "value"
      }
    }
  }
}
```

Or as a local file:

```json
{
  "plugins": {
    "./scripts/release-it-plugin.js": {
      "key": "value"
    }
  }
}
```

## Plugin package layout

`release-it` should be a `peerDependency` (and typically a `devDependency` too for testing):

```json
{
  "name": "release-it-plugin",
  "version": "1.0.0",
  "description": "My release-it plugin",
  "main": "index.js",
  "peerDependencies": {
    "release-it": "^14.2.0"
  },
  "devDependencies": {
    "release-it": "^14.2.0"
  }
}
```

Or scaffold from the [plugin-starterkit](https://github.com/release-it/plugin-starterkit).

## Interface overview

```js
class Plugin {
  static isEnabled() {}
  static disablePlugin() {}
  getInitialOptions() {}
  init() {}
  getName() {}
  getLatestVersion() {}
  getIncrement() {}
  getIncrementedVersionCI() {}
  getIncrementedVersion() {}
  beforeBump() {}
  bump() {}
  beforeRelease() {}
  release() {}
  afterRelease() {}
}
```

In the signatures below, a `**returns:**` type may be returned directly _or_ as a Promise
resolving to it.

## Static methods

### `isEnabled()`

**returns:** `Boolean`

Defaults to always-enabled. Override to gate the plugin on configuration or the presence of a
file or directory. See the [Custom version plugin
recipe](/release-it/guides/recipes/custom-version-plugin/) for an `fs.accessSync` example.

### `disablePlugin()`

**returns:** `String`

If your plugin replaces one of the core plugins, return the name to disable — a string or an
array of strings from `version`, `git`, `github`, `gitlab`, `npm`.

## Release-cycle methods

Every method here runs asynchronously; use `async/await` freely. Return `false` when a step is
skipped so `after:[plugin]:[method]` hooks skip too — especially important for `release`.

### `init()`

Validate prerequisites, gather application or package details, resolve the current version.

### `beforeBump()`

Prepare information the user should see _before_ picking the next version — a changelog
preview, a diff summary, whatever helps them confirm.

### `bump()`

**parameters:** `version: string`

Write the new version into whatever files your plugin owns (`package.json`, `VERSION`,
`composer.json`, …).

### `beforeRelease()`

Between the bump and the release — stage files, run last-minute validations.

### `release()`

The main step. Wrap each user-visible operation in [`this.step()`](#thisstep); it
renders as a prompt in interactive mode and as a spinner in CI mode.

### `afterRelease()`

Report a successful release — a link, a stat, a notification.

## Getter methods

Implement any of these to override the corresponding core-plugin value.

### `getName()`

**returns:** `String`

Return the package name.

### `getLatestVersion()`

**returns:** `SemVer`

Return the version prior to the current release so release-it can compute the next one.

### `getInitialOptions()`

**parameters:** `(options, pluginName)`  
**returns:** `Object`

By default, each plugin receives `options[pluginName]`. Override to pull data from _other_
plugins' options:

```js
getInitialOptions(options, pluginName) {
  return Object.assign({}, options[pluginName], {
    tagName: options.git.tagName,
  });
}
```

### Internal getters (rarely needed)

#### `getIncrement()`

**parameters:** `{ latestVersion, increment, isPreRelease, preReleaseId }`  
**returns:** `String`

Override the increment used by `getIncrementedVersionCI` — return `major`, `minor`, or
`patch`.

#### `getIncrementedVersionCI()`

**parameters:** `{ latestVersion, increment, isPreRelease, preReleaseId }`  
**returns:** `SemVer`

Return the next version _without_ prompting. Used to seed introduction text and other early
render steps.

#### `getIncrementedVersion()`

**parameters:** `{ latestVersion, increment, isPreRelease, preReleaseId }`  
**returns:** `SemVer`

Same as `getIncrementedVersionCI` but may prompt the user when it can't be derived
automatically.

## Helper methods

### `this.setContext()`

**parameters:** `context`  
**returns:** `void`

Set additional runtime data local to the plugin.

### `this.getContext()`

**returns:** `Object`

Read the plugin options plus anything you added via `setContext`.

### `this.registerPrompts()`

**parameters:** `...prompts`  
**returns:** `void`

Register one or more Inquirer.js prompts:

```js
{
  type: 'confirm',
  name: 'my-prompt',
  message: 'Are you sure?'
}
```

Backed by [Inquirer.js](https://github.com/SBoudrias/Inquirer.js); prompt shape docs
[here](https://github.com/SBoudrias/Inquirer.js/#objects).

### `this.step()`

**returns:** `Promise`

Render a prompt (interactive) or spinner (CI) during `release`:

```js
await this.step({
  enabled: true,
  task: () => this.doTask(),
  label: 'Doing task',
  prompt: 'my-prompt'
});
```

If the prompt returns "No", `task` isn't called.

### `this.exec()`

**returns:** `Promise`

Execute a shell command. Used extensively internally for `git` and `npm` invocations. Template
variables are interpolated — `git log ${latestTag}...HEAD` becomes `git log v1.2.3...HEAD`.

See the [Template variables reference](/release-it/reference/template-variables/) for the full
list of variables you can interpolate. Available in every release-cycle method except `init`.

Dry runs skip mutations by default. Mark a command as read-only so it also runs in dry mode:

```js
this.exec('git log', { options: { write: false } });
```

### `this.debug()`

**returns:** `void`

Log namespaced diagnostics. Enable with `NODE_DEBUG=release-it:*`.

### `this.log()`

Use `this.log.verbose`, `this.log.warn`, `this.log.error`, `this.log.log`, `this.log.info` to
inform the user.

## See also

- [Execution order](/release-it/explanations/execution-order/) — when each method runs.
- [Plugin architecture](/release-it/explanations/plugin-architecture/) — the "why" behind it.
- Every plugin listed under
  [`release-it-plugin`](https://www.npmjs.com/search?q=keywords:release-it-plugin) on npm.
- Internal release-it plugins:
  [`lib/plugin`](https://github.com/release-it/release-it/tree/main/lib/plugin).
