---
title: GitHub options
description: Reference for release-it's GitHub plugin — release naming, notes, drafts, assets, comments, and discussions.
sidebar:
  label: GitHub
  order: 4
---

See the [GitHub Releases guide](/release-it/guides/publishing/github-releases/) for usage examples of these options.


> [!NOTE]
> Every option on this page must live under the `github` namespace in your
> [release-it configuration](/release-it/guides/core-workflow/configuration/), e.g.:
>
> ```json
> {
>   "github": {
>     "release": true,
>     "releaseName": "Release ${version}"
>   }
> }
> ```

## `release`

**type:** `boolean`  
**default:** `false`

Set to `true` to publish a GitHub Release; `false` to skip the step.

## `releaseName`

**type:** `string`  
**default:** `"Release ${version}"`

Set the release name.

## `releaseNotes`

**type:** `string | null | { commit?: string; excludeMatches?: string[] }`  
**default:** `null`

Override the release notes with custom notes.

## `autoGenerate`

**type:** `boolean`  
**default:** `false`

Let GitHub generate release notes (overrides other notes!).

## `preRelease`

**type:** `boolean`  
**default:** `false`

Set the release to a pre-release status.

## `draft`

**type:** `boolean`  
**default:** `false`

Set the release to a draft status.

## `tokenRef`

**type:** `string`  
**default:** `"GITHUB_TOKEN"`

Name of the environment variable that holds the GitHub token.

## `assets`

**type:** `string | string[] | null`  
**default:** `null`

Glob pattern path to assets to add to the GitHub release.

## `host`

**type:** `string | null`  
**default:** `null`

Use a different host from what would be derived from the Git URL.

## `timeout`

**type:** `integer` _(seconds; `0` disables)_  
**default:** `0`

Timeout duration to wait for a response from the GitHub API.

## `proxy`

**type:** `string | null`  
**default:** `null`

If the release is performed behind a proxy, set this to the proxy URL.

## `skipChecks`

**type:** `boolean`  
**default:** `false`

Skip checks on the `GITHUB_TOKEN` environment variable and user permissions.

## `web`

**type:** `boolean`  
**default:** `false`

Explicitly override checking if the `GITHUB_TOKEN` is set.

## `makeLatest`

**type:** `boolean | "legacy"`  
**default:** `true`

Set to `false` for non-latest releases (e.g. supporting back-ports).

## `discussionCategoryName`

**type:** `string`  
**default:** _(unset)_

Auto-create a GitHub Discussion in the given category and link to it from the release.

## `comments.submit`

**type:** `boolean`  
**default:** `false`

Submit a comment to each merged PR and closed issue included in the release.

## `comments.issue`

**type:** `string`  
**default:** `":rocket: _This issue has been resolved in v${version}. See [${releaseName}](${releaseUrl}) for release notes._"`

The text added to associated closed issues.

## `comments.pr`

**type:** `string`  
**default:** `":rocket: _This pull request is included in v${version}. See [${releaseName}](${releaseUrl}) for release notes._"`

The text added to associated merged pull requests.
