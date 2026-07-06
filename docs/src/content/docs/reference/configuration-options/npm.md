---
title: npm options
description: Reference for release-it's npm plugin — publishing, staging, OTP, and package-manager selection.
sidebar:
  label: npm
  order: 3
---

See the [npm guide](/release-it/guides/publishing/npm/) for usage examples of these options.


> [!NOTE]
> Every option on this page must live under the `npm` namespace in your
> [release-it configuration](/release-it/guides/core-workflow/configuration/), e.g.:
>
> ```json
> {
>   "npm": {
>     "publish": true,
>     "tag": "beta"
>   }
> }
> ```

## `publish`

**type:** `boolean`  
**default:** `true`

Set to `false` to skip the npm publish step.

## `stage`

**type:** `boolean`  
**default:** `false`

Submit to the staging queue (`stage publish`) for later 2FA approval (npm, pnpm).

## `publishPath`

**type:** `string`  
**default:** `"."`

Publish only a specific folder (e.g. `dist`).

## `publishArgs`

**type:** `string[]`  
**default:** `[]`

Extra arguments passed to `npm publish`.

## `publishPackageManager`

**type:** `"npm" | "pnpm" | "bun"`  
**default:** `"npm"`

Use `pnpm` or `bun` to publish instead of `npm`.

## `tag`

**type:** `string | null`  
**default:** `null`

Use e.g. `npm.tag=beta` to tag the package in the npm repository.

## `otp`

**type:** `string | null`  
**default:** `null`

The one-time password (OTP) can be provided from the command line (`npm.otp=123456`).

## `ignoreVersion`

**type:** `boolean`  
**default:** `false`

When set to `true`, ignore the `version` from `package.json`.

## `allowSameVersion`

**type:** `boolean`  
**default:** `false`

Allow the new version to be the same value as the current version.

## `versionArgs`

**type:** `string[]`  
**default:** `[]`

Extra arguments passed to `npm version`.

## `skipChecks`

**type:** `boolean`  
**default:** `false`

Skip checks on whether the npm registry is up and the user has publish permissions.

## `timeout`

**type:** `integer` _(seconds)_  
**default:** `10`

Timeout duration to wait for a response from the npm registry.
