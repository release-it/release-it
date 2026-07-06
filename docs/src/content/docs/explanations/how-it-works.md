---
title: How release-it works
description: The mental model — the release pipeline, how the steps line up, where hooks fit, and how to troubleshoot.
---

release-it doesn't try to guess how you release your software. It runs a small, well-defined
pipeline in the right order, and lets each step be opted-in, opted-out, or replaced. This page
covers the mental model.

## The pipeline

For every release, release-it runs (in this order):

1. **Init** — validate prerequisites, load configuration.
2. **Bump** — decide the next version (or let a plugin decide) and write it to disk.
3. **Release** — run each plugin's `release` step: commit + tag + push (Git), create a release
   (GitHub / GitLab), publish (npm), plus anything you add.
4. **Cleanup / notify** — `afterRelease` hooks.

Each step has `before:` and `after:` hook points you can attach shell commands to; see
[Hooks](/release-it/guides/core-workflow/hooks/) for the how-to and
[Hook names](/release-it/reference/hook-names/) for the full grammar.

## Related explanations

- [Version detection](/release-it/explanations/version-detection/) — how the _current_
  version is discovered before the bump.
- [Interactive vs CI mode](/release-it/explanations/interactive-vs-ci/) — the two operating
  modes and how release-it switches between them.
- [Updating a release](/release-it/explanations/updating-a-release/) — re-running when a
  release half-succeeded.
- [Execution order](/release-it/explanations/execution-order/) — when each plugin's
  release-cycle methods fire.
- [Plugin architecture](/release-it/explanations/plugin-architecture/) — how plugins slot into
  the pipeline.

## Troubleshooting

- `release-it --verbose` (or `-V`) — print every user-defined hook's output.
- `release-it -VV` — also print every internal command's output.
- `NODE_DEBUG=release-it:* release-it …` — dump configuration and error details.

Set `verbose: 2` in configuration for the same effect as `-VV`.
