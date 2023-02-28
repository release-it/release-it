# Publish to npm

With a `package.json` in the current directory, release-it will let `npm` bump the version in `package.json` (and
`package-lock.json` if present), and publish to the npm registry.

If there is a `package.json` but it should be ignored and nothing should be published to npm, use `--no-npm` or
`"npm": false` in the release-it configuration.

## Prerequisite checks

To prevent issues later in the process, release-it first checks whether the npm registry is up, the user is
authenticated with npm and is a collaborator for the current package.

Some instances of npm registries, such as Nexus, do not support `npm ping`, `npm whoami` and/or `npm access`. If the
error is a `E400` or `E404`, release-it will give a warning but continue.

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

In order to publish a scoped package to the public registry, specify this at the root of `package.json`:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

The default value for private packages is `"restricted"`.

## Publish to private registry

The default registry is https://registry.npmjs.org. The publish to another registry, update or set the `publishConfig`
in `package.json`. For example:

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

## Two-factor authentication

In case two-factor authentication (2FA) is enabled for the package, release-it will ask for the one-time password (OTP).

The OTP can be provided from the command line (`--npm.otp=123456`). However, providing the OTP without a prompt
basically defeats the purpose of 2FA (also, the OTP expires after a short period).

## Publish path

Use `npm.publishPath` to publish only a specific folder. For example, set `npm.publishPath` to `"dist"`. The default
value is the current (root) folder (`"."`).

## Extra arguments

Use `npm.versionArgs` and/or `npm.publishArgs` to pass extra arguments to `npm version` and `npm publish`, respectively.
Example:

```json
{
  "npm": {
    "versionArgs": ["--allow-same-version", "--workspaces-update=false"],
    "publishArgs": ["--include-workspace-root"]
  }
}
```

Use `npm.allowSameVersion` to prevent throwing error when setting the new version to the same value as the current
version. This option may become deprecated, it is recommended to use `versionArgs` for this.

## Monorepos

Monorepos do not require extra configuration, but release-it handles only one package at a time. Also see how
[Git steps can be skipped](#skip-git-steps). This is useful if, for instance, tagging the Git repo should be skipped.

To bump multiple `package.json` files in a monorepo to the same version, use the
[@release-it/bumper](https://github.com/release-it/bumper) plugin.

For Yarn workspaces, see the [release-it-yarn-workspaces](https://github.com/rwjblue/release-it-yarn-workspaces) plugin.

## Miscellaneous

- When `npm version` fails, the release is aborted (except when using
  [`--no-increment`](../README.md#update-or-re-run-existing-releases)).
- Learn how to [authenticate and publish from a CI/CD environment](./ci.md#npm).
- The `"private": true` setting in package.json will be respected, and `release-it` will skip this step.
- Getting an `ENEEDAUTH` error while a manual `npm publish` works? Please see
  [#95](https://github.com/release-it/release-it/issues/95#issuecomment-344919384).
