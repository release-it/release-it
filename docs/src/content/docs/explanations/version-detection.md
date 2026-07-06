---
title: Version detection
description: How release-it decides the current version before computing the next one — the resolution order and the alternate sources plugins can provide.
---

release-it needs to know the _current_ version to compute the _next_ one. It resolves it in
this order:

1. If a plugin implements
   [`getLatestVersion()`](/release-it/reference/plugin-api/#getlatestversion), that value wins.
2. Otherwise, if `package.json` exists, its `version` field is used — unless you opt out with
   [`npm.ignoreVersion`](/release-it/reference/configuration-options/npm/#ignoreversion) or
   disable npm entirely with `--no-npm`.
3. Otherwise, the latest Git tag (via `git describe` by default; see
   [`git.getLatestTagFromAllRefs`](/release-it/reference/configuration-options/git/#getlatesttagfromallrefs)).
4. As a last resort, `0.0.0`.

## Alternate sources (via plugins)

- [@release-it/bumper](https://github.com/release-it/bumper) — read/write versions in any
  file.
- [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) —
  derive a recommended bump from commit messages.
- [release-it-calver-plugin](https://github.com/casmith/release-it-calver-plugin) — Calendar
  Versioning (CalVer).

See [Community plugins](/release-it/reference/community-plugins/) for more.

## Print the next version without releasing

```bash
release-it --release-version
```

## Why this order

The rule of thumb: **the most specific source wins**. A custom plugin knows things release-it
doesn't; `package.json` is the canonical source for npm packages; Git tags are the last-resort
history for anything else. The `0.0.0` fallback keeps first releases from failing.

## See also

- [How release-it works](/release-it/explanations/how-it-works/) — the release pipeline that
  consumes this version.
- [Execution order](/release-it/explanations/execution-order/) — how plugins interact when
  multiple can supply a version.
