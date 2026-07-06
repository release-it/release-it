---
title: What is release-it?
description: A generic CLI tool that automates versioning, tagging, changelog generation, and publishing — from your terminal or your CI.
---

**release-it** is a generic CLI tool that automates the small, repetitive tasks around cutting a
release of a software project:

- Bumping the version (in `package.json` or any other file, through plugins).
- Committing, tagging, and pushing to Git.
- Creating a [GitHub Release](/release-it/guides/publishing/github-releases/) or
  [GitLab Release](/release-it/guides/publishing/gitlab-releases/).
- Generating a [changelog](/release-it/guides/core-workflow/changelog/) from your commit history.
- [Publishing](/release-it/guides/publishing/npm/) to npm — including support for
  [Trusted Publishing (OIDC)](/release-it/guides/publishing/npm/#trusted-publishing-oidc) and
  [staged publishing](/release-it/guides/publishing/npm/#staged-publishing).
- Running arbitrary test / build / notify commands via [hooks](/release-it/guides/core-workflow/hooks/).

It ships with a full **plugin architecture**, so anything else you need to do at release time
can be added on top.

## Two modes

release-it is **interactive by default** — it asks you to confirm each step:

![release-it interactive demo](../../../assets/release-it-interactive.gif)

Add `--ci` (or run it inside a Continuous Integration environment, where it turns on
automatically) and the same flow runs unattended. See
[Interactive vs CI mode](/release-it/explanations/interactive-vs-ci/) for the
details.

## Where to go next

- New to release-it? → [Installation](/release-it/start/installation/) and
  [Your first release](/release-it/start/first-release/).
- Ready to automate? → [Automating in CI](/release-it/start/automating-in-ci/).
- Looking for a specific task? → Browse the [Guides](/release-it/guides/core-workflow/configuration/).
- Need option reference? → [Configuration options](/release-it/reference/configuration-options/).
- Want to understand how it ticks? → [How release-it works](/release-it/explanations/how-it-works/).
