---
title: Publish to npm
description: Publish to npm with release-it — tags, publishPath, extra args, 2FA (WebAuthn), Trusted Publishing (OIDC), staged publishing, and monorepos.
---

When a `package.json` exists in the current directory, release-it lets `npm` bump the version
(both in `package.json` and, if present, `package-lock.json`) and publishes to the npm registry.

- To _only_ skip the publish step: `npm.publish: false`.
- To ignore the `package.json` entirely (no bump, no publish): `--no-npm` or
  `"npm": false`.

For the full list of `npm.*` options, see
[Configuration options → npm](/release-it/reference/configuration-options/npm/).

## Prerequisite checks

Before publishing, release-it verifies the npm registry is reachable, that you're authenticated,
and that you're a collaborator on the package.

Some private registries (e.g. Nexus) don't implement `npm ping`, `npm whoami`, or `npm access`.
On `E400` / `E404` release-it warns and continues. Skip checks entirely with `npm.skipChecks`.

## Skip publish

Bump the version in `package.json` but stay off the registry:

```json
{
  "npm": {
    "publish": false
  }
}
```

Ignore npm entirely: `"npm": false` (or `--no-npm`).

## Ignore the version in `package.json`

Fall back to the latest Git tag instead:

```json
{
  "npm": {
    "ignoreVersion": true
  }
}
```

Or `--npm.ignoreVersion` on the command line.

## Tags

Use `--npm.tag=beta` to publish under a specific
[dist-tag](https://docs.npmjs.com/cli/dist-tag). The default tag is `latest`.

- `--preRelease=beta` also sets the npm dist-tag to `beta` (unless `--npm.tag` overrides it).
- For any pre-release, the dist-tag defaults to `next`, and to the pre-release identifier
  (`alpha`, `beta`, …) if the version has one.

## Public scoped packages

A [scoped package](https://docs.npmjs.com/about-scopes) (`@user/pkg`) is private by default —
which requires a paid npm account. To publish it as public, add to `package.json`:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

## Private registries

Point `publishConfig.registry` at your registry:

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

## Custom public path

Some registries (e.g. Verdaccio) expose a different public URL for packages. Configure it via
`publishConfig`:

```json
{
  "publishConfig": {
    "publicPath": "/-/web/detail"
  }
}
```

## Yarn

Yarn sets or overrides global environment variables in ways that can break `npm publish`
authentication. Setting `publishConfig.registry` makes release-it pass `--registry=…` to every
`npm` invocation, working around it:

```json
{
  "publishConfig": {
    "registry": "https://registry.npmjs.org"
  }
}
```

## Two-factor authentication

With classic 2FA enabled, release-it prompts for the one-time password (OTP).

`--npm.otp=123456` accepts an OTP from the command line — but that defeats the point of 2FA and
the code expires quickly.

**Security keys / passkeys (WebAuthn)** don't produce an OTP; npm opens a browser or device
prompt on publish. release-it runs `npm publish` on an inherited terminal so this works
seamlessly in interactive runs (including `--only-version`). For CI or fully non-interactive
publishing, use [staged publishing](#staged-publishing) — the 2FA "proof of presence" defers to
`npm stage approve`.

## Publish path

Publish only a subdirectory with `npm.publishPath`. For example, set it to `"dist"`. Default:
the current folder (`.`).

## Extra arguments

Pass extra args through with `npm.versionArgs` and `npm.publishArgs`:

```json
{
  "npm": {
    "versionArgs": ["--allow-same-version", "--workspaces-update=false"],
    "publishArgs": ["--include-workspace-root"]
  }
}
```

`npm.allowSameVersion` still works but is on track to be deprecated — prefer `versionArgs`.

## Monorepos

Monorepos don't need special configuration: release-it handles one package at a time. See
[Skip Git steps](/release-it/guides/publishing/git/#skipping-steps) for how to keep individual workspaces
from re-tagging.

- Bump every workspace's `package.json` to the same version with the
  [@release-it/bumper](https://github.com/release-it/bumper) plugin.
- Full walk-through: [Monorepo recipe](/release-it/guides/recipes/monorepo/).
- Yarn workspaces? Use
  [release-it-yarn-workspaces](https://github.com/release-it-plugins/workspaces).

## Trusted Publishing (OIDC)

npm's [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) uses OpenID Connect
(OIDC) for token-free publishing from CI/CD. No long-lived tokens; provenance attestations
happen automatically.

All three steps below are required.

### 1. Configure npmjs.com

1. Log into npmjs.com.
2. Open your package's **Settings** tab.
3. Click **Select your publisher** and fill in the form.

### 2. Configure release-it

Skip npm authentication checks (see
[#1244](https://github.com/release-it/release-it/issues/1244#issuecomment-3217898680)):

```json
{
  "npm": {
    "skipChecks": true
  }
}
```

### 3. Configure your workflow

- Grant `id-token: write`.
- Remove `NODE_AUTH_TOKEN` / `NPM_TOKEN`.
- Upgrade to npm ≥ 11.5.1 (Node 20 ships 10.8, so update it explicitly).

```yaml
# GitHub Actions
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write # for git operations
      id-token: write # REQUIRED for OIDC
    steps:
      - uses: actions/checkout
      - uses: actions/setup-node
        with:
          node-version: 'lts/*'
          registry-url: 'https://registry.npmjs.org'

      # OIDC requires npm v11.5.1 or later; Node 20 ships v10.8.
      - run: npm install -g npm@latest
      - run: npm ci
      - run: npx release-it --ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Do NOT set NPM_TOKEN / NODE_AUTH_TOKEN.
```

## Staged publishing

npm's [staged publishing](https://docs.npmjs.com/staged-publishing) adds a human approval step
before a version goes live. release-it submits the tarball to a stage queue; a maintainer
approves with 2FA (CLI or npmjs.com) before it becomes installable.

```json
{
  "npm": {
    "stage": true
  }
}
```

release-it then runs `npm stage publish` (or `pnpm stage publish`) instead of a direct publish.
Submitting to the stage does **not** require 2FA, so it composes with CI. The 2FA "proof of
presence" happens at approval time. Approve afterwards:

```
npm stage list                # find the staged version
npm stage view <stage-id>     # inspect it
npm stage approve <stage-id>  # publish it (prompts for 2FA)
# or reject it:
npm stage reject <stage-id>
```

Staged packages can also be reviewed and approved from the **Staged** tab on npmjs.com.

- Supported by npm CLI v11.15.0+ and pnpm v11.3.0+, on Node v22.14.0+.
- Composes with the other options (`tag`, `publishPath`, `publishArgs`, scoped/private
  registries).
- A [trusted publisher](#trusted-publishing-oidc) can be set to **stage-only**, so even CI
  publishes require an approval step.

## Miscellaneous

- When `npm version` fails, the release is aborted (except with `--no-increment`).
- To authenticate and publish from a CI/CD environment, see the [CI guide](/release-it/guides/ci/environments/).
- `"private": true` in `package.json` is respected; release-it skips the publish step.
- `ENEEDAUTH` even though `npm publish` works manually? See
  [#95](https://github.com/release-it/release-it/issues/95#issuecomment-344919384).
