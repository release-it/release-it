# Publish to npm

With a `package.json` in the current directory, release-it will let `npm` bump the version in `package.json` (and
`package-lock.json` if present), and publish to the npm registry.

If there is a `package.json` but it should be ignored and nothing should be published to npm, use `--no-npm` or
`"npm": false` in the release-it configuration.

## Prerequisite checks

First, release-it checks whether the npm registry is up and the user is authenticated with npm to prevent issues later
on in the process.

Some instances of npm registries, such as Nexus, do not support `npm ping` and/or `npm whoami`. If the error is a `E400`
or `E404`, release-it will give a warning but continue.

To skip these checks, use `npm.skipChecks`.

## Skip publish

To bump the version in `package.json` with the release, but not publish to the registry:

```json
{
  "npm": {
    "publish": false
  }
}
```

In case there is a `package.json`, but no npm-related tasks should be executed, use `"npm": false` (or `--no-npm`).

## Ignore version

To ignore the `version` from `package.json`, (and use the latest Git tag instead):

```json
{
  "npm": {
    "ignoreVersion": true
  }
}
```

Or `--npm.ignoreVersion` from the command line.

## Tags

Use e.g. `--npm.tag=beta` to tag the package in the npm repository. With the `--preRelease=beta` shorthand, the npm
dist-tag will have the same value (unless `--npm.tag` is used to override this). The default tag is "latest".

For a pre-release, the default tag is "next". The tag will be derived from the pre-release version (e.g. version
`2.0.0-alpha.3` will result in tag "alpha"), unless overridden by setting `npm.tag`.

## Public scoped packages

A [scoped package](https://docs.npmjs.com/about-scopes) (e.g. `@user/package`) is either public or private. By default,
`npm publish` will publish a scoped package as private. Note that scoped packages require a paid account.

In order to publish a scoped package to the public registry, specify this in `package.json`:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

The default value for private packages is `"restricted"`.

## Two-factor authentication

In case two-factor authentication (2FA) is enabled for the package, release-it will ask for the one-time password (OTP).

The OTP can be provided from the command line (`--npm.otp=123456`). However, providing the OTP without a prompt
basically defeats the purpose of 2FA (also, the OTP expires after a short period).

## Publish path

Use `npm.publishPath` to publish only a specific folder. For example, set `npm.publishPath` to `"dist"`. The default
value is the current (root) folder (`"."`).

## Monorepos

Monorepos do not require extra configuration, but release-it handles only one package at a time. Also see how
[Git steps can be skipped](#skip-git-steps). This is useful if, for instance, tagging the Git repo should be skipped.

For Yarn workspaces, see the [release-it-yarn-workspaces](https://github.com/rwjblue/release-it-yarn-workspaces) plugin.

## Miscellaneous

- Learn how to [authenticate and publish from a CI/CD environment](./ci.md#npm).
- The `"private": true` setting in package.json will be respected, and `release-it` will skip this step.
- Getting an `ENEEDAUTH` error while a manual `npm publish` works? Please see
  [#95](https://github.com/release-it/release-it/issues/95#issuecomment-344919384).
