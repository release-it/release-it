# Plugins

Since v11, release-it has evolved into a pluggable task runner. It was previously limited to Git-based repositories,
GitHub/GitLab releases, and npm packages, but this is no longer the case. As long as can either be written in Node.js,
or executed from the shell, it can be integrated in the release-it process.

Plugins allow additional and custom actions in the release process, such as:

- Publish the package to any registry (this is language-agnostic, e.g. Ruby, Python, ...).
- Implement a different strategy to generate changelogs and/or release notes.
- Trigger web hooks (e.g. post a message to a Slack channel).
- Use a different VCS, such as Mercurial (example: [@release-it/mercurial](https://github.com/release-it/mercurial)).
- Use Node.js directly (instead of executing shell scripts configured in `scripts.*`).
- Not yet possible: replace existing plugins. For instance, integrate with the npm registry using their
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
        "option": "value"
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
      "option": "value"
    }
  }
}
```

## Creating a plugin

To create a plugin, extend the `Plugin` class, and implement one or more release-cycle methods. See the "interface"
below (where none of the methods is required). Any of these methods can be `async` (except for
`getIncrementedVersionSync`). If you're interested in writing a plugin, please take a look at
[the `runTasks` test helper](https://github.com/release-it/release-it/blob/master/test/util/index.js#L33-L54), to see
how a plugin is integrated in the release process. Also see the
[base `Plugin` class](https://github.com/release-it/release-it/blob/master/lib/plugin/Plugin.js) where the plugin should
be extended from.

## Interface

```javascript
class Plugin {
  static isEnabled() {}
  init() {}
  getName() {}
  getLatestVersion() {}
  getIncrementedVersionSync() {}
  getIncrementedVersion() {}
  beforeBump() {}
  bump() {}
  beforeRelease() {}
  release() {}
  afterRelease();
}
```

### Example

This minimal example reads the current version from a `VERSION` file, and bumps it once the new version is known.

```javascript
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

## Conditionally enable the plugin

By default, a plugin is always enabled. Override the static `isEnabled` method to enable the plugin based on specific
conditions, such as plugin configuration or the presence of a file or directory.

## Release-cycle methods

Implement release-cycle methods to execute logic during the release process.

### `init`

Implement `init` to validate prequisites and gather application or package details such as the current version.

The `init` method for all plugins are run async in parallel.

### `beforeBump`

Implement `beforeBump` to prepare things, gather and/or output interesting information for the user, such as a changelog
or other details to help the user confirm the release will be executed properly.

### `bump`

Implement `bump` to increment the version in manifests or other files containing the version of the application or
package (e.g. `package.json` for Node.js modules). This method receives the incremented `version` as the first and only
argument.

### `beforeRelease`

Implement `beforeRelease` to perform tasks that should happen after the bump, and to stage things before the `release`.

### `release`

Implement `release` for the main flow of the plugin. This is where the "steps" should be declared (see [step](#step) in
class API), resulting in prompts (interactive) or spinners (non-interactive) that will execute tasks for confirmed
steps.

### `afterRelease`

Implement `afterRelease` to provide details about a successful release, e.g. a link to the release page.

## Getter methods

### `getName`

Provide the name of the package being released.

### `getLatestVersion`

Implement `getLatestVersion` and return the latest version prior to the current release, so release-it can determine the
next version.

### `getIncrementedVersionSync`

Implement `getIncrementedVersionSync` to provide the next version (must be synchronous). This should normally not be
implemented in a custom plugin, but left to the internal `version` plugin.

### `getIncrementedVersion`

Implement `getIncrementedVersion` to provide the next version (can be async). This should normally not be implemented in
a custom plugin, but left to the internal `version` plugin.

## Class API

The `Plugin` class exposes helper methods, here's an overview:

### `setContext`

Set additional data during runtime.

### `getContext`

Get the plugin options, plus additional runtime data set with `setContext`.

### `registerPrompts`

Register one or more prompts and allow the user to confirm actions or provide details.

### `exec`

Execute commands in the child process (i.e. the shell). This is used extensively by release-it to execute `git` and
`npm` commands. Be aware of cross-OS compatibility.

Use template variables to render replacements. For instance, the command `git log ${latestTag}...HEAD` becomes
`git log v1.2.3...HEAD` before being executed.

### `step`

Display a prompt or a spinner during the `run` release-cycle method. A prompt if interactive, or a spinner in
non-interactive mode.

### `debug`

Insert `this.debug(...)` statements to log interesting details when `DEBUG=release-it:* release-it ...` is used. The
output is namespaced automatically (e.g. `release-it:foo My log output`).

### `log`

Use `this.log.[verbose|warn|error]` to log and inform the user about what's going on in the release process.

### Examples

- [my-version](https://github.com/release-it/release-it/blob/master/docs/recipes/my-version.md) - reads and writes a
  local `./VERSION` file, and includes a prompt to let the user confirm before publishing to a package registry.
- [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) - uses
  `conventional-recommended-bump` in `getIncrementedVersion()` and `conventional-changelog` in `beforeRelease` to
  generate the changelog. Optionally updates `CHANGELOG.md`.
- [@release-it/mercurial](https://github.com/release-it/mercurial) - use Mercurial
- [npm](https://github.com/release-it/release-it/blob/master/lib/plugin/npm/npm.js) - the internal release-it plugin to
  publish a package to npm.
