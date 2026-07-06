---
title: Hook names
description: The full list of release-it hook names, the naming grammar, and which hooks skip when the underlying step fails.
---

Every hook name follows one of these two patterns:

```text
[prefix]:[hook]
[prefix]:[plugin]:[hook]
```

| Part     | Values                                        |
| :------- | :-------------------------------------------- |
| `prefix` | `before` or `after`                           |
| `plugin` | `version`, `git`, `npm`, `github`, `gitlab`   |
| `hook`   | `init`, `bump`, `release`                     |

The middle `plugin` slot is optional. Without it, the hook fires before/after that lifecycle
step across **all** plugins.

## Internal hook list

For the sake of completeness, the full internal hook list release-it fires is:

```text
init
beforeBump
bump
beforeRelease
release
afterRelease
```

Names like `before:beforeRelease` read awkwardly and are rarely useful — prefer `before:bump`,
`before:release`, etc.

## Skipped steps skip their hooks

`after:git:release` (and its siblings) will **not** run when the underlying `git push` failed,
or when the step was explicitly disabled (e.g. `git.push: false`). See
[Execution order](/release-it/explanations/execution-order/) for the details.

## See also

- [Hooks guide](/release-it/guides/core-workflow/hooks/) — usage, examples, debugging.
- [Template variables](/release-it/reference/template-variables/) — the values you can
  interpolate into hook commands.
