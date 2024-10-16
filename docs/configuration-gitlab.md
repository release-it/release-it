### GitLab configuration options

| Option | Description |
| --- | --- |
| `gitlab.release` | Set to `false` to skip the GitLab publish step. |
| `gitlab.releaseName` | Set the release name, which is `Release ${version}` by default. |
| `gitlab.releaseNotes` |  Override the release notes with custom notes. |
| `gitlab.milestones` | To associate one or more milestones with a GitLab release, set the `gitlab.milestones` option to an array of the titles of the corresponding milestones. |
| `gitlab.tokenRef` |  Set this to a string to change the name of the GitLab token environment variable (defaults to `GITLAB_TOKEN`). |
| `gitlab.tokenHeader` | _TODO: Docs to be added._ |
| `gitlab.certificateAuthorityFile` | _TODO: Docs to be added._ |
| `gitlab.secure` | _TODO: Docs to be added._ |
| `gitlab.assets` | Glob pattern path to assets to add to the GitLab release. |
| `gitlab.origin` | _TODO: Docs to be added._  |
| `gitlab.skipChecks` | If set to `true`, skip checks on whether the `GITLAB_TOKEN` environment variable is set and whether the given milestones exist. |
