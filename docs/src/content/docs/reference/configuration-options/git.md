---
title: Git options
description: Reference for release-it's git plugin — commit, tag, push, and branch-safety options.
sidebar:
  label: Git
  order: 2
---

See the [Git guide](/release-it/guides/publishing/git/) for usage examples of these options.


> [!NOTE]
> Every option on this page must live under the `git` namespace in your
> [release-it configuration](/release-it/guides/core-workflow/configuration/), e.g.:
>
> ```json
> {
>   "git": {
>     "requireCleanWorkingDir": true,
>     "commitMessage": "chore: release v${version}"
>   }
> }
> ```

## `changelog`

**type:** `string`  
**default:** `` "git log --pretty=format:\"* %s (%h)\" ${from}...${to}" ``

Changelog generation command.

## `requireCleanWorkingDir`

**type:** `boolean`  
**default:** `true`

Require that all file changes are committed.

## `requireBranch`

**type:** `false | string | string[]`  
**default:** `false`

Require that the release is on a particular branch name (or one of a list of names).

## `requireUpstream`

**type:** `boolean`  
**default:** `true`

Require that an upstream remote exists.

## `requireCommits`

**type:** `boolean`  
**default:** `false`

Stop the process if there are no commits since the previous release.

## `requireCommitsFail`

**type:** `boolean`  
**default:** `true`

If there are no commits, continue but use exit code `0`.

## `commitsPath`

**type:** `string`  
**default:** `""`

The path to the directory that should be included in the release changes.

## `addUntrackedFiles`

**type:** `boolean`  
**default:** `false`

Add untracked files to the release commit.

## `commit`

**type:** `boolean`  
**default:** `true`

If `false`, skip the commit release step.

## `commitMessage`

**type:** `string`  
**default:** `"Release ${version}"`

The message to add to the commit step.

## `commitArgs`

**type:** `string[]`  
**default:** `[]`

Provide extra arguments to `git commit`.

## `tag`

**type:** `boolean`  
**default:** `true`

If `false`, skip the tag release step.

## `tagExclude`

**type:** `string | null`  
**default:** `null`

Override the normal behavior to find the latest tag.

## `tagName`

**type:** `string | null`  
**default:** `null`

Custom tag name, which may not be the same as the (prefixed) version.

## `tagMatch`

**type:** `string | null`  
**default:** `null`

Override the normal matching behavior to find the latest tag.

## `getLatestTagFromAllRefs`

**type:** `boolean`  
**default:** `false`

Consider all tags (directly reachable or not, sorted by version).

## `tagAnnotation`

**type:** `string`  
**default:** `"Release ${version}"`

Message string for annotating the Git tag.

## `tagArgs`

**type:** `string[]`  
**default:** `[]`

Provide extra arguments to `git tag`.

## `push`

**type:** `boolean`  
**default:** `true`

If `false`, skip the push release step.

## `pushArgs`

**type:** `string[]`  
**default:** `["--follow-tags"]`

Provide extra arguments to `git push`.

## `pushRepo`

**type:** `string`  
**default:** `""`

Remote name or Git URL to push the release to. Empty string defers to git's default (usually
`origin`).
