---
title: Updating a release
description: How to re-run release-it when a release half-succeeded — updating the same tag rather than incrementing to a new version.
---

Sometimes a release goes half-way — the tag exists, but publishing failed. Rather than force
you to bump to a new version to try again, release-it supports updating _the same_ tag with
targeted skip flags.

## The flags

- `--no-increment` — don't compute a new version; use the existing one.
- `--no-git` — skip Git steps (the tag is already pushed).
- `--no-npm` — skip npm publish (already succeeded).
- `--no-github` / `--no-gitlab` — skip the corresponding release.

Combine whichever apply to your situation.

## Common scenarios

### Add assets to a draft GitHub Release

You released to a draft, then realized an asset is missing. Re-run and target only the
GitHub step — see the
[GitHub Releases guide](/release-it/guides/publishing/github-releases/#update-the-latest-release).

### npm succeeded, `git push` failed

The package is live on npm but the tag never made it to the remote. Re-run with:

```bash
release-it --no-increment --no-npm
```

release-it re-uses the current version, skips the (already-done) npm publish, and re-pushes
the tag and any git-side follow-up.

### Only re-issue the GitHub Release

```bash
release-it --no-increment --no-git --no-npm
```

## Why not just re-run the same command?

Without `--no-increment`, release-it will insist on bumping to a new version — because from
its point of view, the tag is already used. The skip flags tell it "the previous run
_partially_ worked; only redo what I ask".

## See also

- [How release-it works](/release-it/explanations/how-it-works/) — the pipeline these flags
  short-circuit.
- [Interactive vs CI mode](/release-it/explanations/interactive-vs-ci/) — matters when a CI
  run needs to be re-tried locally.
