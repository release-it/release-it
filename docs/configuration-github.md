### GitHub configuration options

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
