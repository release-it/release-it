# Prerequisites

There are a number of things release-it does before starting the actual release process. Here is an overview, including
ways you can change release-it's behavior.

## Git

### Clean working directory

The working directory should be clean (i.e. `git status` should say something like this:

```
$ git status
On branch master
Your branch is up to date with 'origin/master'.

nothing to commit, working tree clean
```

Make sure to commit, stash, or revert the changes before running release-it. In case the currently staged changes should
be committed with the release commit, use `--no-git.requireCleanWorkingDir` or configure
`"git.requireCleanWorkingDir": false`.

### Upstream branch

If no upstream branch is known to Git, it does not know where to push the release commit and tag to, and halts.

Use `--no-git.requireUpstream` to add `-u [remote] [branch]` to the `git push` command, where `[remote]` is the value of
`git.pushRepo` ("origin" by default), and `[branch]` is the name of the current branch. So if the current branch is
`next` then the full command becomes `git push --follow-tags -u origin next`.

Configure `pushRepo` with either a remote name or a Git url to push the release to that remote instead of "origin".

Disabling `git.requireUpstream` is useful when releasing from a different branch (that is not yet tracking cq present on
a remote). Or similar, when releasing a (new) project that did not push to the remote before. Please note that in
general you should not need this, as it is considered a best practice to release from the `master` branch only. Here is
an example use case and how it can be handled using release-it:

- After a major release (v2), a bug is found and a fix released in v2.0.1.
- The fix should be backported to v1, so a branch "v1" is made and the fix is cherry-picked.
- The release of v1.x.x can be done while still in this branch using `release-it --no-git.requireUpstream`.

### No commits

By default, release-it does not check the number of commits upfront to prevent "empty" releases. Configure
`"git.requireCommits": true` to exit the release-it process if there are no commits since the latest tag.

Also see the [Require Commits](./recipes/require-commits.md) recipe(s).

## npm

For npm repositories, release-it first checks whether the npm registry is up and the user is authenticated with npm to
prevent issues later on in the process.

Some instances of npm registries, such as Nexus, do not support `npm ping` and/or `npm whoami`. If the error is a `E400`
or `E404`, release-it will give a warning but continue.

## GitHub and GitLab

When `github.release` and/or `gitlab.release` is set to `true`, release-it will check whether the `GITHUB_TOKEN` (or
`GITLAB_TOKEN`) environment variable is set. Otherwise it will throw an error and exit. The name of the variable can be
set with `github.tokenRef` and `gitlab.tokenRef`, respectively.
