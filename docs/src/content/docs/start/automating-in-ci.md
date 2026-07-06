---
title: Automating in CI
description: Run release-it non-interactively from GitHub Actions with an NPM_TOKEN and GITHUB_TOKEN.
---

release-it detects Continuous Integration environments and switches to non-interactive mode
automatically. You can also force it with the `--ci` flag.

This page is the quick starting guide — see the full [CI environments
guide](/release-it/guides/ci/environments/) for GitLab CI, Travis, CircleCI, SSH keys, HTTPS token URLs, and
GitLab-CI-specific troubleshooting.

## GitHub Actions

A minimal workflow that publishes a new version on manual dispatch:

```yaml
# .github/workflows/release.yml
name: Release

on:
  workflow_dispatch:

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write # only if you use npm Trusted Publishing (OIDC)
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          registry-url: 'https://registry.npmjs.org'
      - run: |
          git config user.name  "${GITHUB_ACTOR}"
          git config user.email "${GITHUB_ACTOR}@users.noreply.github.com"
      - run: npm ci
      - run: npx release-it --ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN:    ${{ secrets.NPM_TOKEN }}
```

- `fetch-depth: 0` is required if any plugin (e.g.
  [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog))
  needs the full Git history.
- `GITHUB_TOKEN` is what release-it uses to create the GitHub release. See
  [Environment variables](/release-it/guides/core-workflow/environment-variables/) for other approaches.
- To publish to npm without a long-lived `NPM_TOKEN`, use npm's
  [Trusted Publishing (OIDC)](/release-it/guides/publishing/npm/#trusted-publishing-oidc).

## Learn more

- [CI environments](/release-it/guides/ci/environments/) — GitLab CI, Travis, CircleCI, SSH vs HTTPS, and
  troubleshooting.
- [Environment variables](/release-it/guides/core-workflow/environment-variables/) — token storage patterns.
- [Publish to npm](/release-it/guides/publishing/npm/) — 2FA, WebAuthn, staged publishing, OIDC.
