---
title: GitLab options
description: Reference for release-it's GitLab plugin — release naming, notes, milestones, CA files, and generic-package uploads.
sidebar:
  label: GitLab
  order: 5
---

See the [GitLab Releases guide](/release-it/guides/publishing/gitlab-releases/) for usage examples of these options.


> [!NOTE]
> Every option on this page must live under the `gitlab` namespace in your
> [release-it configuration](/release-it/guides/core-workflow/configuration/), e.g.:
>
> ```json
> {
>   "gitlab": {
>     "release": true,
>     "milestones": ["${version}"]
>   }
> }
> ```

## `release`

**type:** `boolean`  
**default:** `false`

Set to `true` to publish a GitLab Release; `false` to skip the step.

## `releaseName`

**type:** `string`  
**default:** `"Release ${version}"`

Set the release name.

## `releaseNotes`

**type:** `string | null`  
**default:** `null`

Override the release notes with custom notes.

## `milestones`

**type:** `string[]`  
**default:** `[]`

Associate one or more milestones with the GitLab release.

## `tokenRef`

**type:** `string`  
**default:** `"GITLAB_TOKEN"`

Name of the environment variable that holds the GitLab token.

## `tokenHeader`

**type:** `string`  
**default:** `"Private-Token"`

HTTP header name for the GitLab token.

## `certificateAuthorityFile`

**type:** `string | null`  
**default:** `null`

Path of the GitLab CA file for self-hosted installations.

## `certificateAuthorityFileRef`

**type:** `string`  
**default:** `"CI_SERVER_TLS_CA_FILE"`

Name of the environment variable that holds the path to the GitLab CA file.

## `secure`

**type:** `boolean`  
**default:** `false`

Flag to disable server certificate verification.

## `assets`

**type:** `string | string[] | null`  
**default:** `null`

Glob pattern path to assets to add to the GitLab release.

## `useIdsForUrls`

**type:** `boolean`  
**default:** `false`

Use the new asset URL format required by GitLab 17.2+.

## `useGenericPackageRepositoryForAssets`

**type:** `boolean`  
**default:** `false`

Upload assets via GitLab's Generic Packages Repository.

## `genericPackageRepositoryName`

**type:** `string`  
**default:** `"release-it"`

Package name for the Generic Packages Repository.

## `origin`

**type:** `string | null`  
**default:** `null`

Base URL to use for the GitLab API. Falls back to `https://${repo.host}` when unset.

## `skipChecks`

**type:** `boolean`  
**default:** `false`

Skip checks on the `GITLAB_TOKEN` environment variable and milestone(s).
