### Git configuration options

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
| `git.tagAnnotation` | Message string for annotating the Git tag. |
| `git.tagArgs` | In case extra arguments should be provided to Git for tagging operations. |
| `git.push` | If `false`, skip the push release step |
| `git.pushArgs` | In case extra arguments should be provided to Git for push operations. |
| `git.pushRepo` | To push the release to somewhere other than `origin`, set this to a string for either a remote name or a Git URL. |
