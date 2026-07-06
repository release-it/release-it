---
title: Configuration options
description: Every release-it configuration option, grouped by plugin namespace (git, npm, github, gitlab). Defaults come from the runtime config.
sidebar:
  label: Overview
  order: 1
---

Every option lives under its plugin namespace in the [release-it
configuration](/release-it/guides/core-workflow/configuration/). Defaults live in
[`config/release-it.json`](https://github.com/release-it/release-it/blob/main/config/release-it.json)
in the release-it repository.

Browse the options grouped by plugin:

- [Git options](/release-it/reference/configuration-options/git/) — commit, tag, and push behavior.
- [npm options](/release-it/reference/configuration-options/npm/) — publishing, staging, OTP, package manager selection.
- [GitHub options](/release-it/reference/configuration-options/github/) — GitHub Releases, comments, discussions.
- [GitLab options](/release-it/reference/configuration-options/gitlab/) — GitLab Releases, milestones, packages.

See the accompanying guides for narrative and examples:
[Git](/release-it/guides/publishing/git/) · [npm](/release-it/guides/publishing/npm/) ·
[GitHub Releases](/release-it/guides/publishing/github-releases/) ·
[GitLab Releases](/release-it/guides/publishing/gitlab-releases/).