# Configuration

Out of the box, release-it has sane defaults, and [plenty of options][1] to configure it.

Put only the options to override in a configuration file. Here is a list of file names where release-it looks for
configuration in the root of the project:

- `.release-it.json`
- `.release-it.js` (or `.cjs`; export the configuration object: `module.exports = {}`)
- `.release-it.yaml` (or `.yml`)
- `.release-it.toml`
- `package.json` (in the `release-it` property)

Use `--config path/release-it.json` to use another configuration file location.

An example `.release-it.json`:

```json
{
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

[1]: ../config/release-it.json
