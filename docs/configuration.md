# Configuration

Out of the box, release-it has sane defaults. See the [configuration options][1] to configure it.

Put only the options to override in a configuration file. Here is a list of file names where release-it looks for
configuration in the root of the project:

- `.release-it.json`
- `.release-it.ts`
- `.release-it.js` (or `.cjs`; export the configuration object: `module.exports = {}`)
- `.release-it.yaml` (or `.yml`)
- `.release-it.toml`
- `package.json` (in the `release-it` property)

Use `--config path/release-it.json` to use another configuration file location.

An example `.release-it.json`:

```json
{
  "$schema": "https://unpkg.com/release-it@17/schema/release-it.json",
  "git": {
    "commitMessage": "chore: release v${version}"
  },
  "github": {
    "release": true
  }
}
```

The configuration can also be stored in a `release-it` property in `package.json`:

```json
{
  "name": "my-package",
  "devDependencies": {
    "release-it": "*"
  },
  "release-it": {
    "github": {
      "release": true
    }
  }
}
```

Typescript config files are supported, providing typing hints to the config:

```ts
import type { Config } from 'release-it';

export default {
  git: {
    commit: true,
    tag: true,
    push: true
  },
  github: {
    release: true
  },
  npm: {
    publish: true
  }
} satisfies Config;
```

Or, use YAML in `.release-it.yml`:

```yaml
git:
  requireCleanWorkingDir: false
```

TOML is also supported in `.release-it.toml`:

```toml
[hooks]
"before:init" = "npm test"
```

## Configuration options

Release-it has [plenty of options][2] to configure. See the table below for
descriptions of each.

### Hooks

| Option | Description |
| --- | --- |
| `hooks` | Use script hooks to run shell commands at any moment during the release process (such as `before:init` or `after:release`). |

### Git

| Option | Description |
| --- | --- |
| `git.changelog` | Override the changelog generation behavior, which is based on `git log` by default. |
| `git.requireCleanWorkingDir` | Require that all file changes are committed. |
| `git.requireBranch` | Require that the release is on a particular branch name (e.g. `dev`), or `false` to disable this option. |
| `git.requireUpstream` | Require that an upstream remote exists. Disable this option to release from a branch that has not yet been published to a remote, such as from a brand new project. |
| `git.requireCommits` | Stop the process if there are no commits since the previous release. |
| `git.requireCommitsFail` | If there are no commits, halt the release with exit code 0, but don't stop the process. This may be used in CI so that the whole pipeline doesn't fail. |
| `git.commitsPath` | The path to the directory that should be included in the release changes. |
| `git.addUntrackedFiles` | If `true`, add untracked files to the release commit. |
| `git.commit` | If `false`, skip the commit release step. |
| `git.commitMessage` | The message to add to the commit step. |
| `git.commitArgs` | In case extra arguments should be provided to Git for commit args. |
| `git.tag` | If `false`, skip the tag release step |
| `git.tagExclude` | String used to override the normal behavior to find the latest tag. I.e. to exclude pre-releases from a tag, set this to `*[-]*` to exclude everything with a hyphen, which is normally used exclusively in pre-releases. Note that `git.tagExclude` has no effect when `git.getLatestTagFromAllRefs: true` is set. |
| `git.tagName` | String used to set a custom tag name, which may not be the same as the (prefixed) version. |
| `git.tagMatch` | Glob string used to override the normal matching behavior to find the latest tag. Note that this uses a glob, not a regex. |
| `git.getLatestTagFromAllRefs` | If `true`, considers all tags (sorting them by version), whether directly reachable or not (e.g. include tags that point to sibling commits on different branches) |
| `git.tagAnnotation` | _TODO: Docs to be added._ |
| `git.tagArgs` | In case extra arguments should be provided to Git for tagging operations. |
| `git.push` | If `false`, skip the push release step |
| `git.pushArgs` | In case extra arguments should be provided to Git for push operations. |
| `git.pushRepo` | To push the release to somewhere other than `origin`, set this to a string for either a remote name or a Git URL. |

### npm

| Option | Description |
| --- | --- |
| `npm.publish` | Set to `false` to skip the npm publish step. |
| `npm.publishPath` | Publish only a specific folder (e.g. `dist`). |
| `npm.publishArgs` | In case extra arguments should be provided to npm for the publish operation. |
| `npm.tag` | Use e.g. `npm.tag=beta` to tag the package in the npm repository. |
| `npm.otp` | In case two-factor authentication (2FA) is enabled for the package, release-it will ask for the one-time password (OTP). The OTP can be provided from the command line (`npm.otp=123456`). However, providing the OTP without a prompt basically defeats the purpose of 2FA. |
| `npm.ignoreVersion` | When set to `true`, ignore the `version` from `package.json`. |
| `npm.allowSameVersion` | If set to `true`, prevents throwing error when setting the new version to the same value as the current version. Note it is recommended to use `versionArgs` for this instead. |
| `npm.versionArgs` | In case extra arguments should be provided to npm for the versioning operation. |
| `npm.skipChecks` | If set to `true`, skip checks on whether the npm registry is up, the user is authenticated with npm and is a collaborator for the current package. |
| `npm.timeout` | Timeout duration to wait for a response from the npm registry. |

### GitHub

| Option | Description |
| --- | --- |
| `github.release` | Set to `false` to skip the GitHub publish step. |
| `github.releaseName` | Set the release name, which is `Release ${version}` by default. |
| `github.releaseNotes` | Override the release notes with custom notes. |
| `github.autoGenerate` | Set to `true` to let GitHub generate release notes. |
| `github.preRelease` | Set to `true` to set the release to a pre-release status. |
| `github.draft` | Set to `true` to set the release to a draft status. |
| `github.tokenRef` | Set this to a string to change the name of the GitHub token environment variable (defaults to `GITHUB_TOKEN`). |
| `github.assets` | Glob pattern path to assets to add to the GitHub release. |
| `github.host` | Use a different host from what would be derived from the Git URL (e.g. when using GitHub Enterprise). |
| `github.timeout` | Timeout duration to wait for a response from the GitHub API. |
| `github.proxy` | If the release is performed behind a proxy, set this to string of the proxy URL. |
| `github.skipChecks` | If set to `true`, skip checks on whether the `GITHUB_TOKEN` environment variable is set, will authenticate, and verify whether the current user is a collaborator and authorized to publish a release. |
| `github.web` | Set to `true` to explicitly override checking if the `GITHUB_TOKEN` is set. |
| `github.comments.submit` | Set to `true` to submit a comment to each merged pull requests and closed issues that are part of the release. |
| `github.comments.issue` | The text to add to the associated closed issues. |
| `github.comments.pr` | The text to add to the associated merged pull requests. |

### GitLab

| Option | Description |
| --- | --- |
| `gitlab.release` | Set to `false` to skip the GitLab publish step. |
| `gitlab.releaseName` | Set the release name, which is `Release ${version}` by default. |
| `gitlab.releaseNotes` |  Override the release notes with custom notes. |
| `gitlab.milestones` | To associate one or more milestones with a GitLab release, set the `gitlab.milestones` option to an array of the titles of the corresponding milestones. |
| `gitlab.tokenRef` |  Set this to a string to change the name of the GitHub token environment variable (defaults to `GITLAB_TOKEN`). |
| `gitlab.tokenHeader` | _TODO: Docs to be added._ |
| `gitlab.certificateAuthorityFile` | _TODO: Docs to be added._ |
| `gitlab.secure` | _TODO: Docs to be added._ |
| `gitlab.assets` | Glob pattern path to assets to add to the GitHub release. |
| `gitlab.origin` | _TODO: Docs to be added._  |
| `gitlab.skipChecks` | If set to `true`, skip checks on whether the `GITLAB_TOKEN` environment variable is set and whether the given milestones exist. |


## Setting options via CLI

Any option can also be set on the command-line, and will have highest priority. Example:

```bash
release-it minor --git.requireBranch=main --github.release
```

Boolean arguments can be negated by using the `no-` prefix:

```bash
release-it --no-npm.publish
```

Also plugin options can be set from the command line:

```bash
release-it --no-plugins.@release-it/keep-a-changelog.strictLatest
```

[1]: #configuration-options
[2]: ../config/release-it.json
