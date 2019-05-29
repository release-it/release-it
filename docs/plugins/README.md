# Plugins

Since v11, release-it has evolved into a pluggable task runner. It was previously limited to Git-based repositories,
GitHub/GitLab releases, and npm packages, but this is no longer the case. As long as can either be written in Node.js,
or executed from the shell, it can be integrated in the release-it process.

## Contents

- [Overview](#overview)
- [Using a plugin](#using-a-plugin)
- [Creating a plugin](#creating-a-plugin)
- [Available & example plugins](#available--example-plugins)

### Overview

Plugins allow additional and custom actions in the release process, such as:

- Publish the package to any registry (this is language-agnostic, e.g. Ruby, Python, ...).
- Implement a different strategy to generate changelogs and/or release notes.
- Trigger web hooks (e.g. post a message to a Slack channel).
- Use a different VCS, such as Mercurial (example: [@release-it/mercurial](https://github.com/release-it/mercurial)).
- Use Node.js directly (instead of executing shell scripts configured in `scripts.*`).
- Replace existing plugins. For instance, integrate with the npm registry using their
  [programmatic API](https://github.com/npm/libnpm) (as opposed to calling `npm publish` in a child process like
  release-it itself does).

Internally, release-it uses its own plugin architecture and includes the following plugins:

- `git`
- `github`
- `gitlab`
- `npm`
- `version`

Each plugin has a different responsibility, and each enables itself:

- The `git` plugin is enabled if the current directory contains a `.git` directory.
- The `github` plugin becomes active if `github.release` is `true`.
- The `gitlab` plugin is enabled only if `gitlab.release` is `true`.
- The `npm` plugin looks for a `package.json` in the current directory.
- The `version` plugin is always enabled (it increments the version and prompts for it if needed).

## Using a plugin

Plugins are local to the project, or external npm packages. Plugin configuration consists of a module name with options.
This example uses the `release-it-bar` module and is configured in `package.json`:

```json
{
  "devDependencies": {
    "release-it": "*",
    "release-it-bar": "*"
  },
  "release-it": {
    "github": {
      "release": true
    },
    "plugins": {
      "release-it-bar": {
        "key": "value"
      }
    }
  }
}
```

Alternatively, here's a `foo` plugin as a local module:

```json
{
  "plugins": {
    "./scripts/foo.js": {
      "key": "value"
    }
  }
}
```

## Creating a plugin

To create a plugin, extend the `Plugin` class, and implement one or more release-cycle methods. See the "interface"
below (where none of the methods is required). Any of these methods can be `async` (except for
`getIncrementedVersionCI`). If you're interested in writing a plugin, please take a look at
[the `runTasks` test helper](https://github.com/release-it/release-it/blob/master/test/util/index.js#L33-L54), to see
how a plugin is integrated in the release process. Also see the
[base `Plugin` class](https://github.com/release-it/release-it/blob/master/lib/plugin/Plugin.js) where the plugin should
be extended from.

### Example

This minimal example reads the current version from a `VERSION` file, and bumps it once the new version is known.

```js
class MyPlugin extends Plugin {
  getLatestVersion() {
    return fs.readFileSync('./VERSION').trim();
  }
  bump(version) {
    this.version = version;
    fs.writeFileSync('./VERSION', version);
  }
}
```

This plugin has made itself responsible for providing the latest version by implementing the `getLatestVersion` method.
Also, it writes the new version in the `./VERSION` file during the release process.

In the context of the whole release process, this may also be relevant for other plugins:

- If the `npm` plugin is enabled, that plugin will bump `package.json` with the return value of `getLatestVersion`.
- If the `git` plugin is enabled, its `beforeRelease` method will stage the changes so the updated `./VERSION` will be
  part of the release commit.

Since order matters here, the release-cycle methods of internal plugins are executed _after_ other plugins. Except for
the `release` and `afterRelease` methods at the end.

## API

- [Interface overview](#interface-overview)
- [Static methods](#static-methods)
- [Release-cycle methods](#release-cycle-methods)
- [Getter methods](#getter-methods)
- [Helper methods](#helper-methods)
- [Execution Order](#execution-order)

### Interface overview

```js
class Plugin {
  static isEnabled() {}
  static disablePlugin() {}
  getInitialOptions() {}
  init() {}
  getName() {}
  getLatestVersion() {}
  getIncrementedVersionCI() {}
  getIncrementedVersion() {}
  beforeBump() {}
  bump() {}
  beforeRelease() {}
  release() {}
  afterRelease();
}
```

Note that any of the methods in the plugin can be `async` except for `disablePlugin()`. In the method signatures below
this is implied everywhere (e.g. `→ Boolean` means it should return a boolean, or a promise resolving to a boolean).

### Static methods

#### isEnabled() → Boolean

By default, a plugin is always enabled. Override the static `isEnabled` method to enable the plugin based on specific
conditions, such as plugin configuration or the presence of a file or directory.

#### disablePlugin() → String

In case a plugin replaces a core plugin, it should be disabled by returning the name of the core plugin. Return a string
(or array of strings) containing the plugin name (one or more of `version`, `git`, `github`, `gitlab`, `npm`).

### Release-cycle methods

Implement release-cycle methods to execute logic during the release process. All methods are run async, so `async/await`
can be used freely.

#### init()

Implement `init` to validate prequisites and gather application or package details such as the current version.

The `init` method for all plugins are run async in parallel.

#### beforeBump()

Implement `beforeBump` to prepare things, gather and/or output interesting information for the user, such as a changelog
or other details to help the user confirm the release will be executed properly.

#### bump(version)

Implement `bump` to increment the version in manifests or other files containing the version of the application or
package (e.g. `package.json` for Node.js modules).

#### beforeRelease()

Implement `beforeRelease` to perform tasks that should happen after the bump, and stage things before the `release`.

#### release()

Implement `release` for the main flow of the plugin. This is where the "steps" should be declared (see [step](#step) in
class API), resulting in prompts (interactive) or spinners (non-interactive) that will execute tasks for confirmed
steps.

#### afterRelease()

Implement `afterRelease` to provide details about a successful release, e.g. a link to the release page.

## Getter methods

Implement any of the following methods to be ahead of any core plugin and use that during the release process instead.

#### getName() → String

Provide the name of the package being released.

#### getLatestVersion() → SemVer

Implement `getLatestVersion` and return the latest version prior to the current release, so release-it can determine the
next version.

#### getInitialOptions(options, pluginName) → Object

By default, every plugin receives the options configured in `options[pluginName]`. For instance, the core `npm` plugin
receives the options under the `npm` property in the configuration. Other plugins receive the options as they are
configured in the `plugins` section. However, if a plugin requires additional options from other plugins, the
`getInitialOptions` is useful:

```js
getInitialOptions(options, pluginName) {
  return Object.assign({}, options[pluginName], {
    tagName: options.git.tagName,
  });
}
```

#### Internal getter methods

The following methods are mostly internal methods that normally should not be implemented in any plugin, but in rare
cases this might be useful.

##### getIncrementedVersionCI({ latestVersion, increment, isPreRelease, preReleaseId }) → SemVer

Implement `getIncrementedVersionCI` to provide the next version without prompting the user. I.e. determine the next
version based on the provided values. This method exists to provide the next `version` to other elements of the release
process early on, such as `scripts.beforeStart` and the introduction text.

##### getIncrementedVersion({ latestVersion, increment, isPreRelease, preReleaseId }) → SemVer

Implement `getIncrementedVersion` to provide the next version, and prompt the user if this can't be determined
automatically.

### Helper methods

The `Plugin` class exposes helper methods, here's an overview:

#### this.setContext(context) → void

Set additional data local to the plugin during runtime.

#### this.getContext() → Object

Get the plugin options extended with additional runtime data set with `setContext`.

#### this.registerPrompts(...prompts) → void

Register one or more prompts and allow the user to confirm actions or provide details.

A prompt object looks like this:

```js
{
  type: 'confirm',
  name: 'my-prompt',
  message: 'Are you sure?'
}
```

Under the hood, [Inquirer.js](https://github.com/SBoudrias/Inquirer.js) is used. See
[Inquirer.js/#objects](https://github.com/SBoudrias/Inquirer.js/#objects) for more details.

#### this.step() → Promise

Display a prompt or a spinner during the `release` release-cycle method. This automatically shows a prompt if
interactive, or a spinner in CI (non-interactive) mode.

```js
await this.step({
  enabled: true,
  task: () => this.doTask(),
  label: 'Doing task',
  prompt: 'my-prompt'
});
```

If the prompt receives a "No" from the user, the `task` callback is not executed.

#### this.exec() → Promise

Execute commands in the child process (i.e. the shell). This is used extensively by release-it to execute `git` and
`npm` commands. Be aware of cross-OS compatibility.

Use template variables to render replacements. For instance, the command `git log ${latestTag}...HEAD` becomes
`git log v1.2.3...HEAD` before being executed. The replacements are all configuration options (with the default values
in [conf/release-it.json](conf/release-it.json)), plus the following variables:

```
version
latestVersion
latestTag
changelog
name
repo.remote, repo.protocol, repo.host, repo.owner, repo.repository, repo.project
```

All variables are available from `beforeBump` (i.e. not in `init`).

Note that in dry runs, commands are **not** executed as they may contain write operations. Read-only operations should
add the `write: false` option to run in dry mode:

```js
this.exec('git log', { options: { write: false } });
```

#### this.debug() → void

Insert `this.debug(...)` statements to log interesting details when `DEBUG=release-it:* release-it ...` is used. The
output is namespaced automatically (e.g. `release-it:foo My log output`).

#### this.log() → void

Use `this.log.[verbose|warn|error|log|info]` to log and inform the user about what's going on in the release process.

### Execution order

Assuming there are two plugins configured, "PluginA" and "PluginB":

```json
{
  "plugins": {
    "PluginA": {},
    "PluginB": {}
  }
}
```

First, the `init` method is executed for `PluginA`, then `PluginB`, and then the core plugins: `npm` → `gitlab` →
`github` → `git` → `version`.

Then the same for `getName` and `getLatestVersion`. For these getter methods, the value of the first plugin that returns
something is used throughout the release process. This allows a plugin to be ahead of core plugins.

After this, the `beforeBump`, `bump` and `beforeRelease` methods are executed for each plugin in the same order.

And finally, for `release` and `afterRelease` the order is reversed, so that tasks can be executed after release-it core
plugins are done. Examples include to trigger deployment hooks, or send a notification to indicate a successfull release
or deployment.

Here's an example. If the `npm` plugin is enabled, `npm.getName()` is the first plugin/method that returns something
(the `name` from `package.json` is used in this case). If this plugin is not enabled, `getName` of the next plugin is
invoked (e.g. the `git` plugin will infer the name from the remote Git url), etcetera. However, the methods of custom
plugins are invoked first, so they can override the `name`, `latestVersion`, `repo`, and `changelog` values that would
otherwise be taken from the core plugins.

## Available & example plugins

- All packages tagged with [`"release-it-plugin"` on npm](https://www.npmjs.com/search?q=keywords:release-it-plugin).
- [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) - uses
  `conventional-recommended-bump` in `getIncrementedVersion()` and `conventional-changelog` in `beforeRelease` to
  generate the changelog. Optionally updates `CHANGELOG.md`.
- [@release-it/bumper](https://github.com/release-it/bumper) - version read/write plugin for release-it
- [@release-it/mercurial](https://github.com/release-it/mercurial) - use Mercurial
- [npm](https://github.com/release-it/release-it/blob/master/lib/plugin/npm/npm.js) - the internal release-it plugin to
  publish a package to npm.
- recipe: [my-version](https://github.com/release-it/release-it/blob/master/docs/recipes/my-version.md) - example plugin
  that reads and writes a local `./VERSION` file, and includes a prompt to let the user confirm before publishing to a
  package registry.
