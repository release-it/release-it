---
title: Configuration
description: Configure release-it via a JSON / TS / JS / YAML / TOML file, a package.json field, remote extends, or the command line.
---

Out of the box, release-it ships with sensible defaults — you only need to declare the options
you want to override.

For the full list of supported keys, see
[Configuration options](/release-it/reference/configuration-options/).

## Where release-it looks for configuration

release-it scans the project root for one of the following, in order:

- `.release-it.json`
- `.release-it.ts`
- `.release-it.js` (or `.cjs`; `module.exports = {}`)
- `.release-it.yaml` (or `.yml`)
- `.release-it.toml`
- a `release-it` property in `package.json`

Point to a different location with `--config path/release-it.json`.

## Examples

### JSON

```json
{
  "$schema": "https://unpkg.com/release-it@20/schema/release-it.json",
  "git": {
    "commitMessage": "chore: release v${version}"
  },
  "github": {
    "release": true
  }
}
```

### `package.json`

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

### TypeScript

`.release-it.ts` gives you a typed configuration:

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

### YAML

`.release-it.yml`:

```yaml
git:
  requireCleanWorkingDir: false
```

### TOML

`.release-it.toml`:

```toml
[hooks]
"before:init" = "npm test"
```

## Extending configuration

Reuse a remote config with `extends`. Any of these schemes work:

- `github:owner/repo`
- `github:owner/repo#tag`
- `github:owner/repo:subdir#tag`
- `gitlab:…`, `bitbucket:…`, `https:…`

Example:

```json
{
  "$schema": "https://unpkg.com/release-it@20/schema/release-it.json",
  "extends": "github:release-it/release-it-configuration"
}
```

Backed by [c12](https://github.com/unjs/c12?tab=readme-ov-file#extending-configuration).

## Overriding options on the command line

CLI flags have the highest priority:

```bash
release-it minor --git.requireBranch=main --github.release
```

Negate boolean flags with `no-`:

```bash
release-it --no-npm.publish
```

Reach into plugin options:

```bash
release-it --no-plugins.@release-it/keep-a-changelog.strictLatest
```

## See also

- [Hooks](/release-it/guides/core-workflow/hooks/) — run shell commands at every step of the release
  lifecycle.
- [Environment variables](/release-it/guides/core-workflow/environment-variables/) — safely store tokens
  outside your config.
- [Configuration options](/release-it/reference/configuration-options/) — the full option
  reference.
