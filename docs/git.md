# Git

The Git plugin in release-it, by default, does the following:

1. [Prerequisite checks][1]
2. \[Files may be updated by other plugins and/or user commands/hooks]
3. `git add . --update`
4. `git commit -m "[git.commitMessage]"`
5. `git tag --annotate --message="[git.tagAnnotation]" [git.tagName]`
6. `git push [git.pushArgs] [git.pushRepo]`

When not in CI mode, release-it will ask for confirmation before each of the commit, tag, and push steps.

Configure the `[git.*]` options to modify the commands accordingly. See [all options and their default values][2].

The minimum required version of Git is v2.0.0.

## Configuration options

| Option                        | Description                                                              |
| :---------------------------- | :----------------------------------------------------------------------- |
| `git.changelog`               | Changelog generation command                                             |
| `git.requireCleanWorkingDir`  | Require that all file changes are committed                              |
| `git.requireBranch`           | Require that the release is on a particular branch name                  |
| `git.requireUpstream`         | Require that an upstream remote exists.                                  |
| `git.requireCommits`          | Stop the process if there are no commits since the previous release      |
| `git.requireCommitsFail`      | If there are no commits, continue but use exit code `0`                  |
| `git.commitsPath`             | The path to the directory that should be included in the release changes |
| `git.addUntrackedFiles`       | Add untracked files to the release commit                                |
| `git.commit`                  | If `false`, skip the commit release step                                 |
| `git.commitMessage`           | The message to add to the commit step                                    |
| `git.commitArgs`              | Provide extra arguments to `git commit`                                  |
| `git.tag`                     | If `false`, skip the tag release step                                    |
| `git.tagExclude`              | Override the normal behavior to find the latest tag                      |
| `git.tagName`                 | Custom tag name, which may not be the same as the (prefixed) version     |
| `git.tagMatch`                | Override the normal matching behavior to find the latest tag             |
| `git.getLatestTagFromAllRefs` | Consider all tags (directly reachable or not, sorted by version)         |
| `git.tagAnnotation`           | Message string for annotating the Git tag                                |
| `git.tagArgs`                 | Provide extra arguments to `git tag`                                     |
| `git.push`                    | If `false`, skip the push release step                                   |
| `git.pushArgs`                | Provided extra arguments to `git push`                                   |
| `git.pushRepo`                | Remote name or Git URL to push the release to (default `origin`)         |

## Git remotes

SSH keys and Git remotes are assumed to be configured correctly. If a manual `git push` from the command line works,
release-it should be able to do the same.

The following help pages might be useful:

- [Connecting to GitHub with SSH][3]
- [Managing remote repositories][4] (GitHub)
- [Configure SSH and two-step verification][5] (Bitbucket)
- [GitLab and SSH keys][6]

## Remote repository

By default, `release-it` uses branch's tracking information, unless there isn't any, in which case it defaults to
`"origin"` as the remote name to push to. Use `git.pushRepo` to override this with a different remote name, or a
different git url.

## Tag Name

Use `git.tagName` to set a custom tag, not strictly equal to the (prefixed) version. When the latest tag has the `v`
prefix, it will be used again. No need to configure `git.tagName: "v${version}"` in this case.

Examples:

- `--git.tagName=${branchName}-${version}`
- `--git.tagName=${repo.project}-${version}`
- `--git.tagName=${npm.name}@${version}`

## Tag Match

Use `git.tagMatch` to override the normal matching behavior to find the latest tag. For instance, when doing a major
release to find and set the latest major tag, and include all commits in the changelog since this matching tag. Note
that this represents a [glob][7] (not a regex):

Example: `git.tagMatch: "[0-9]*.[0-9]*.[0-9]*"`

This could also be useful when using a plugin to determine the next tag:

Example: `git.tagMatch: "[0-9][0-9].[0-1][0-9].[0-9]*"`

## Tag Exclude

Use `git.tagExclude` to override the normal behavior to find the latest tag. For example when doing a major release and
you want to exclude any sort of pre-releases, use `*[-]*`, as this would exclude everything with a hyphen, which is
normally used exclusively in pre-releases.

Example: `git.tagExclude: *[-]*`

Note that `git.tagExclude` has no effect when `git.getLatestTagFromAllRefs: true`. See the next section [use all refs to
determine latest tag][8] for more details.

## Use all refs to determine latest tag

By default, Git determines the latest tag using [`git describe`][9], which finds the most recent tag _that is reachable
from a commit._ If you wish to consider all tags, e.g. to include tags that point to sibling commits on different
branches, then set `git.getLatestTagFromAllRefs: true` (the default is `false`).

![Determine latest tag from all refs][10]

In the above illustration, releasing from `develop` and incrementing the semver `rc` modifier, when
`git.getLatestTagFromAllRefs: false` (the default), the latest tag is `v1.1.0-rc1`, because that is the most recent tag
reachable from the current commit (the red circle on `develop`). The version to release will therefore be `v1.1.0-rc2`.

Setting `git.getLatestTagFromAllRefs: true` considers all tags (sorting them by version), whether directly reachable or
not. In which case, the latest tag is `v1.1.0` from `main`, and the new version to release is `v1.2.0-rc1`.

## Extra arguments

In case extra arguments should be provided to Git, these options are available:

- `git.commitArgs`
- `git.tagArgs`
- `git.pushArgs`

For example, use `"git.commitArgs": ["-S"]` to sign commits (also see [#35][11]).

Note that `["--follow-tags"]` is the default for `pushArgs` (re-add this manually if necessary). Example with multiple
arguments for `git push`:

```bash
release-it minor --git.pushArgs=--follow-tags --git.pushArgs=--force
```

## Skip Git steps

To skip the Git steps entirely (for instance, if you only want to `npm publish`), this shorthand is available:

```bash
release-it --no-git
```

Use e.g. `git.tag: false` or `--no-git.tag` to skip a single step.

## Untracked files

By default, untracked files are not added to the release commit. Use `git.addUntrackedFiles: true` to override this
behavior.

## Prerequisite checks

### Required branch

This is disabled by default, but release-it can exit the process when the current branch is not as configured:

```json
{
  "git": {
    "requireBranch": "main"
  }
}
```

Use an array to allow releases from more branch names. Wildcards are also allowed (e.g. `release/*`).

### Clean working directory

The working directory should be clean (i.e. `git status` should say something like this:

```bash
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

Make sure to commit, stash, or revert the changes before running release-it. In case the currently staged changes should
be committed with the release commit, use `--no-git.requireCleanWorkingDir` or configure
`"git.requireCleanWorkingDir": false`.

### Upstream branch

If no upstream branch is known to Git, it does not know where to push the release commit and tag to, and halts.

Use `--no-git.requireUpstream` to add `--set-upstream [remote] [branch]` to the `git push` command, where `[remote]` is
the value of `git.pushRepo` ("origin" by default, if no upstream branch), and `[branch]` is the name of the current
branch. So if the current branch is `next` then the full command that release-it will execute becomes
`git push --follow-tags --set-upstream origin next`.

Configure `pushRepo` with either a remote name or a Git url to push the release to that remote instead of `origin`.

Disabling `git.requireUpstream` is useful when releasing from a different branch (that is not yet tracking cq present on
a remote). Or similar, when releasing a (new) project that did not push to the remote before. Please note that in
general you should not need this, as it is considered a best practice to release from the `main` branch only. Here is an
example use case and how it can be handled using release-it:

- After a major release (v2), a bug is found and a fix released in v2.0.1.
- The fix should be backported to v1, so a branch "v1" is made and the fix is cherry-picked.
- The release of v1.x.x can be done while still in this branch using `release-it --no-git.requireUpstream`.

### No commits

By default, release-it does not check the number of commits upfront to prevent "empty" releases. Configure
`"git.requireCommits": true` to exit the release-it process if there are no commits since the latest tag.

Also see the [Require Commits][12] recipe(s).

## Further customizations

In case you need even more customizations, here is some inspiration:

```json
{
  "git": {
    "commitMessage": "chore(release): cut the v${version} release",
    "push": false
  },
  "hooks": {
    "after:bump": ["npm run build"],
    "after:release": "git push origin HEAD"
  }
}
```

Since the `after:release` hook runs after the Git commands, the `git.push` can be disabled, and replaced by a custom
script.

[1]: #prerequisite-checks
[2]: ../config/release-it.json
[3]: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
[4]: https://docs.github.com/en/get-started/getting-started-with-git/managing-remote-repositories
[5]: https://support.atlassian.com/bitbucket-cloud/docs/configure-ssh-and-two-step-verification/
[6]: https://docs.gitlab.com/ce/user/ssh
[7]: https://code.visualstudio.com/docs/editor/glob-patterns
[8]: #use-all-refs-to-determine-latest-tag
[9]: https://git-scm.com/docs/git-describe
[10]: assets/git-version-from-all-refs.svg
[11]: https://github.com/release-it/release-it/issues/350
[12]: ./recipes/require-commits.md
