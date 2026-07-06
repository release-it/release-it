---
title: Interactive vs CI mode
description: The two operating modes of release-it — interactive prompts by default, non-interactive when a CI environment is detected or --ci is forced.
---

release-it is **interactive by default** — it asks you to confirm each step. When running
inside a Continuous Integration environment it auto-detects and switches to non-interactive
mode; you can also force it explicitly:

```bash
release-it --ci
```

## What changes in non-interactive mode

- **No prompts.** release-it picks the increment based on the CLI or config, publishes, and
  exits.
- **Tokens come from the environment;** release-it never prompts for them. See
  [Environment variables](/release-it/guides/core-workflow/environment-variables/).
- **Errors are fatal.** Any failure aborts the run.

## Halfway house: prompt for the version only

Useful when you want the safety of confirming the version but everything else automated:

```bash
release-it --only-version
```

## Auto-detection

release-it detects CI via [`ci-info`](https://github.com/watson/ci-info), so it works out of
the box on GitHub Actions, GitLab CI, CircleCI, Travis, Jenkins, and dozens of others. See
[CI environments](/release-it/guides/ci/environments/) for provider-specific setup notes.

## See also

- [How release-it works](/release-it/explanations/how-it-works/) — the release pipeline that
  runs in both modes.
- [Automating in CI](/release-it/start/automating-in-ci/) — the tutorial-level walkthrough.
- [Updating a release](/release-it/explanations/updating-a-release/) — for when a CI run
  half-succeeds.
