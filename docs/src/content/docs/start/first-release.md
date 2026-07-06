---
title: Your first release
description: Cut your first interactive release with release-it — from a clean working directory to a published tag and GitHub release.
---

Assuming release-it is [installed](/release-it/start/installation/) and you have a `release`
script in your `package.json`, cutting a release takes one command.

## 1. Make sure the working tree is clean

release-it refuses to run with uncommitted changes by default. Commit or stash them first, then:

```bash
git status
```

should say `nothing to commit, working tree clean`.

## 2. Run release-it

```bash
npm run release
```

You'll be prompted step by step:

1. **Select the next version.** release-it suggests `major`, `minor`, `patch`, and each
   pre-release variant based on your current version.
2. **Confirm the commit message** (default: `Release ${version}`).
3. **Confirm the Git tag.**
4. **Confirm the push** to the remote.
5. If enabled, **confirm the GitHub or GitLab release** and **`npm publish`**.

At any prompt you can bail out with `Ctrl+C` — nothing has been pushed until you say so.

## 3. Verify

- `git log -1` should show the release commit.
- `git tag --list` should include the new tag.
- If configured, your [GitHub Release](/release-it/guides/publishing/github-releases/) or
  [GitLab Release](/release-it/guides/publishing/gitlab-releases/) is published, and the package is live on
  the npm registry.

## A tiny starter config

Drop this in `.release-it.json` to get a sensible starting point that commits and pushes a tag,
creates a GitHub release, and publishes to npm:

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

See [Configuration](/release-it/guides/core-workflow/configuration/) for every supported file format
(`.json` / `.ts` / `.js` / `.yaml` / `.toml` / `package.json`) and [Configuration
options](/release-it/reference/configuration-options/) for the full list of knobs.

## Just want to preview?

Add `--dry-run` to print what release-it _would_ do without touching anything:

```bash
npm run release -- --dry-run
```

More on that in [Dry runs](/release-it/guides/core-workflow/dry-runs/).

## Next step

- [Automating in CI](/release-it/start/automating-in-ci/) — the same flow, without prompts.
- [Configuration](/release-it/guides/core-workflow/configuration/) — customise every step.
