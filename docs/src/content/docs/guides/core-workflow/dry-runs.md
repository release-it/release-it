---
title: Dry runs
description: Preview the interactivity and commands release-it would execute — without actually writing anything.
---

Add `--dry-run` to preview a release without touching anything:

```bash
release-it --dry-run
```

Read-only commands still execute (prefixed with `$`); potentially writing / mutating commands
are only printed (prefixed with `!`):

```bash
$ git rev-parse --git-dir
.git
! git add package.json
! git commit --message="Release 0.8.3"
```

## Related read-only helpers

- `--release-version` — print the next version without doing anything else.
- `--changelog` — print the changelog without doing anything else.

Both are useful for wiring release-it into other tooling — for example, feeding the next version
into a build matrix.
