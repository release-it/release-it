---
title: GitLab Releases
description: Create GitLab Releases automatically with release-it — tokens, milestones, assets, private CA authorities, and self-hosted origins.
---

GitLab 11.7+ supports [Releases](https://docs.gitlab.com/api/releases/) as first-class objects
(like GitHub), including release assets. Releases are attached to an existing Git tag — so make
sure the [Git guide](/release-it/guides/publishing/git/) is set up correctly first.

Set up:

- `gitlab.release: true`.
- A [personal access token](https://docs.gitlab.com/user/profile/personal_access_tokens/) with
  the `api` and `self_rotate` scopes.
- The token
  [exposed as an environment variable](/release-it/guides/core-workflow/environment-variables/).

> [!NOTE]
> GitLab Releases don't support pre-releases or drafts.

For the full list of `gitlab.*` options, see
[Configuration options → GitLab](/release-it/reference/configuration-options/gitlab/).

## Prerequisite checks

release-it verifies that `GITLAB_TOKEN` is set, authenticates, and confirms the current user is
authorized to publish releases.

Skip with `gitlab.skipChecks`.

## Release notes

Default: the output of `git.changelog`. Override with `gitlab.releaseNotes` (evaluated just
before the release call).

`gitlab.releaseNotes` accepts a **string** (shell command; must print to `stdout`) or a
**function** (only in `.release-it.js` / `.cjs`).

### String

```json
{
  "gitlab": {
    "release": true,
    "releaseNotes": "generate-release-notes.sh ${latestVersion} ${version}"
  }
}
```

### Function

```js
{
  gitlab: {
    release: true,
    releaseNotes(context) {
      // Remove the first, redundant line (version and date).
      return context.changelog.split('\n').slice(1).join('\n');
    }
  }
}
```

More on generation strategies: [Changelog](/release-it/guides/core-workflow/changelog/).

## Milestones

Associate the release with one or more milestones:

```json
{
  "gitlab": {
    "release": true,
    "milestones": ["${version}"]
  }
}
```

If a milestone doesn't exist, the release fails. release-it checks upfront — skip the check
with `gitlab.skipChecks`.

## Attach binary assets

Glob patterns via `gitlab.assets`:

```json
{
  "gitlab": {
    "release": true,
    "assets": ["dist/*.dmg"]
  }
}
```

GitLab 17.2 [changed the URL format](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/156939)
for uploaded assets. If you're on 17.2+, set `useIdsForUrls: true`:

```json
{
  "gitlab": {
    "release": true,
    "useIdsForUrls": true,
    "assets": ["dist/*.dmg"]
  }
}
```

### Asset storage location

By default, assets go through the project's Markdown uploads API. To use GitLab's Generic
Packages Repository instead, set `useGenericPackageRepositoryForAssets: true`. `useIdsForUrls`
is ignored in this mode. The package name defaults to `release-it`; override with
`genericPackageRepositoryName`:

```json
{
  "gitlab": {
    "release": true,
    "useGenericPackageRepositoryForAssets": true,
    "genericPackageRepositoryName": "release-it",
    "assets": ["dist/*.dmg"]
  }
}
```

## Custom origin

Override the derived API origin (e.g. for `http`, or a non-standard port):

```json
{
  "gitlab": {
    "origin": "http://example.org:3000"
  }
}
```

## Private CA authority

Self-hosted GitLab with an HTTPS certificate from a private CA:

```json
{
  "gitlab": {
    "release": true,
    "tokenHeader": "PRIVATE-TOKEN",
    "certificateAuthorityFile": "./my-root-ca.crt"
  }
}
```

If not set, release-it falls back to the `CI_SERVER_TLS_CA_FILE` environment variable.

To disable certificate verification against the supplied CAs entirely (`fetch`'s
`connect.rejectUnauthorized`):

```json
{
  "gitlab": {
    "release": true,
    "tokenHeader": "PRIVATE-TOKEN",
    "secure": false
  }
}
```

## Update the latest release

Edit release notes or add assets without cutting a new version:

- `--no-increment` — don't bump the version.
- `--no-git` — skip Git commit, tag, push.
- `--no-npm` — skip publishing to npm.

Example: attach a new binary to the current release:

```bash
release-it --no-increment --no-git --gitlab.release --gitlab.assets=*.zip
```
