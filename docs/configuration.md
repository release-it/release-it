# Configuration

Out of the box, release-it has sane defaults. See the [configuration options][1] to configure it.

Put only the options to override in a configuration file. Here is a list of file names where release-it looks for
configuration in the root of the project:

- `.release-it.json`
- `.release-it.ts`
- `.release-it.js` (or `.cjs`; export the configuration object: `module.exports = {}`)
- `.release-it.yaml` (or `.yml`)
- `.release-it.toml`
- `package.json` (in the `release-it` property)

Use `--config path/release-it.json` to use another configuration file location.

An example `.release-it.json`:

```json
{
  "$schema": "https://unpkg.com/release-it@17/schema/release-it.json",
  "git": {
    "commitMessage": "chore: release v${version}"
  },
  "github": {
    "release": true
  }
}
```

The configuration can also be stored in a `release-it` property in `package.json`:

```json
{
  "name": "my-package",
  "devDependencies": {
    "release-it": "*"
  },
  "release-it": {
    "github": {
      "release": true
    }
  }
}
```

Typescript config files are supported, providing typing hints to the config:

```ts
import type { Config } from 'release-it';

export default {
  git: {
    commit: true,
    tag: true,
    push: true
  },
  github: {
    release: true
  },
  npm: {
    publish: true
  }
} satisfies Config;
```

Or, use YAML in `.release-it.yml`:

```yaml
git:
  requireCleanWorkingDir: false
```

TOML is also supported in `.release-it.toml`:

```toml
[hooks]
"before:init" = "npm test"
```

## Configuration options

Release-it has [plenty of options][2]. See the following tables for plugin configuration options:

- [Git](./git.md#configuration-options)
- [npm](./npm.md#configuration-options)
- [GitHub](./github-releases.md#configuration-options)
- [GitLab](./gitlab-releases.md#configuration-options)

### Extend Configuration

You can extend a configuration from a remote source using the `extends` option. The following formats are supported:

- `github>owner/repo`
- `github>owner/repo#tag`
- `github>owner/repo:file#tag`

For example, to extend a configuration from a GitHub repository:

```json
{
  "$schema": "https://unpkg.com/release-it@17/schema/release-it.json",
  "extends": "github>release-it/release-it-configuration"
}
```

Only public GitHub repositories are supported at this time.

## Setting options via CLI

Any option can also be set on the command-line, and will have highest priority. Example:

```bash
release-it minor --git.requireBranch=main --github.release
```

Boolean arguments can be negated by using the `no-` prefix:

```bash
release-it --no-npm.publish
```

Also plugin options can be set from the command line:

```bash
release-it --no-plugins.@release-it/keep-a-changelog.strictLatest
```

[1]: #configuration-options
[2]: ../config/release-it.json
