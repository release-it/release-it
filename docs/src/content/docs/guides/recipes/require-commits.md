---
title: Require Commits recipe
description: Prevent empty releases with git.requireCommits — plus tips for combining with before:init so time-consuming tasks are skipped when there are no commits.
sidebar:
  label: Require Commits
  order: 1
---

By default, release-it doesn't check whether there are any commits since the last release.
Enable that check with:

```json
{
  "git": {
    "requireCommits": true
  }
}
```

If there are no commits since the latest tag, release-it exits.

## Combining with `hooks.before:init`

You probably run tests before every release. But `git.requireCommits` runs _after_
`hooks.before:init`, so tests always run — even for empty releases.

To skip long-running scripts when there's nothing to release, either move them to
`hooks.after:init`, or bail early with a shell check:

```json
{
  "hooks": {
    "before:init": [
      "if [ \"$(git log $(git describe --tags --abbrev=0)..HEAD)\" = \"\" ]; then exit 1; fi;",
      "npm test"
    ]
  }
}
```

Or short-circuit the entire release-it invocation:

```bash
[ "$(git rev-list $(git describe --tags --abbrev=0)..HEAD --count)" = "0" ] || release-it
```
