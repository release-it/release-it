# Plugins

release-it is a pluggable task runner. If it can either be written in Node.js, or executed from the shell, it can be
integrated in the release-it process.

## Contents

- [Overview][1]
- [Using a plugin][2]
- [Creating a plugin][3]
- [Available & example plugins][4]

### Overview

Plugins allow additional and custom actions in the release process, such as:

- Publish the package to any registry (this is language-agnostic, e.g. Ruby, Python, ...).
- Implement a different strategy to generate changelogs and/or release notes.
- Trigger web hooks (e.g. post a message to a Slack channel).
- Use a different VCS, such as Mercurial (example: [@release-it/mercurial][5]).
- Use Node.js directly (instead of executing shell scripts configured in `hooks.*`).
- Replace existing plugins. For instance, integrate with the npm registry using their [programmatic API][6] (as opposed
  to calling `npm publish` in a child process like release-it itself does).

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
This example uses the `release-it-plugin` module and is configured in `package.json`:

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

Alternatively, here's a `release-it-plugin` as a local module:

```json
{
  "plugins": {
    "./scripts/release-it-plugin.js": {
      "key": "value"
    }
  }
}
```

## Creating a plugin

To create a plugin, extend the `Plugin` class, and implement one or more release-cycle methods. See the "interface"
below (where none of the methods is required). Any of these methods can be `async`. See this [test helper][7] to get an
idea of the methods a release-it plugin can implement.

Note that `release-it` should be a `peerDependency` (and probably also a `devDependency` to use its helpers in the
plugin tests). Here's an example `package.json`:

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

Or see the [plugin-starterkit][8] for a good start.

### Example

This minimal example reads the current version from a `VERSION` file, and bumps it once the new version is known.

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

This plugin has made itself responsible for providing the latest version by implementing the `getLatestVersion` method.
Also, it writes the new version in the `./VERSION` file during the release process.

In the context of the whole release process, this may also be relevant for other plugins:

- If the `npm` plugin is enabled, that plugin will bump `package.json` with the return value of `getLatestVersion`.
- If the `git` plugin is enabled, its `beforeRelease` method will stage the changes so the updated `./VERSION` will be
  part of the release commit.

Since order matters here, the release-cycle methods of internal plugins are executed _after_ other plugins. Except for
the `release` and `afterRelease` methods at the end.

## API

- [Interface overview][9]
- [Static methods][10]
- [Release-cycle methods][11]
- [Getter methods][12]
- [Helper methods][13]
- [Execution Order][14]

### Interface overview

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

Make sure any method returns `false` when it's disabled or skipped, in order to skip the execution of the
`after:[plugin]:[method]` hook. this is especially relevant for the `release` method.

#### init()

Implement `init` to validate prerequisites, and gather application or package details such as the current version.

#### beforeBump()

Implement `beforeBump` to prepare things, gather and/or output interesting information for the user, such as a changelog
or other details to help the user confirm the release will be executed properly.

#### bump(version)

Implement `bump` to increment the version in manifests or other files containing the version of the application or
package (e.g. `package.json` for Node.js modules).

#### beforeRelease()

Implement `beforeRelease` to perform tasks that should happen after the bump, and stage things before the `release`.

#### release()

Implement `release` for the main flow of the plugin. This is where the "steps" should be declared (see [step][15] in
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

##### getIncrement({ latestVersion, increment, isPreRelease, preReleaseId }) → String

Implement `getIncrement` to override the increment used by `getIncrementedVersionCI` by providing `major`, `minor` or
`patch`, otherwise staying with Version.js's default logics.

##### getIncrementedVersionCI({ latestVersion, increment, isPreRelease, preReleaseId }) → SemVer

Implement `getIncrementedVersionCI` to provide the next version without prompting the user (i.e. determine the next
version based on the provided `increment` value). This method exists to provide the next `version` to other elements of
the release process early on, such as the introduction text.

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

Under the hood, [Inquirer.js][16] is used. See [Inquirer.js/#objects][17] for more details.

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
in [config/release-it.json][18]), plus the following additional variables:

```text
version
latestVersion
latestTag
changelog
name
repo.remote, repo.protocol, repo.host, repo.owner, repo.repository, repo.project
```

The additional variables are available in every release-cycle method, except `init`.

Note that in dry runs, commands are **not** executed as they may contain write operations. Read-only operations should
add the `write: false` option to run in dry mode:

```js
this.exec('git log', { options: { write: false } });
```

#### this.debug() → void

Insert `this.debug(...)` statements to log interesting details when `NODE_DEBUG=release-it:* release-it ...` is used.
The output is namespaced automatically (e.g. `release-it:foo My log output`).

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

First, the `init` method is executed for `PluginA`, then `PluginB`, and then the core plugins: `npm` → `git` → `github`
→ `gitlab` → `version`.

Then the same for `getName` and `getLatestVersion`. For these getter methods, the value of the first plugin that returns
something is used throughout the release process. This allows a plugin to be ahead of core plugins.

After this, the `beforeBump`, `bump` and `beforeRelease` methods are executed for each plugin in the same order.

And finally, for `release` and `afterRelease` the order is reversed, so that tasks can be executed after release-it core
plugins are done. Examples include to trigger deployment hooks, or send a notification to indicate a successfull release
or deployment.

Here's an example:

- If the `npm` plugin is enabled, `npm.getName()` is the first plugin/method that returns something (the `name` from
  `package.json` is used in this case).
- If this plugin is not enabled, `getName` of the next plugin is invoked (e.g. the `git` plugin will infer the name from
  the remote Git url), etcetera.
- The methods of custom plugins are invoked first, so they can override the `name`, `latestVersion`, `repo`, and
  `changelog` values that would otherwise be taken from the core plugins.

## Available & example plugins

- All packages tagged with [`"release-it-plugin"` on npm][19].
- Recipe: [my-version][20] - example plugin
- [Internal release-it plugins][21]

[1]: #overview
[2]: #using-a-plugin
[3]: #creating-a-plugin
[4]: #available--example-plugins
[5]: https://github.com/release-it/mercurial
[6]: https://github.com/npm/libnpm
[7]: https://github.com/release-it/release-it/blob/main/test/util/index.js#L54
[8]: https://github.com/release-it/plugin-starterkit
[9]: #interface-overview
[10]: #static-methods
[11]: #release-cycle-methods
[12]: #getter-methods
[13]: #helper-methods
[14]: #execution-order
[15]: #step
[16]: https://github.com/SBoudrias/Inquirer.js
[17]: https://github.com/SBoudrias/Inquirer.js/#objects
[18]: ../config/release-it.json
[19]: https://www.npmjs.com/search?q=keywords:release-it-plugin
[20]: https://github.com/release-it/release-it/blob/main/docs/recipes/my-version.md
[21]: https://github.com/release-it/release-it/tree/main/lib/plugin
