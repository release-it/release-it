# Git

The Git plugin in release-it, by default, does the following:

1. [Prerequisite checks](#prerequisite-checks)
1. [Files may be updated by other plugins and/or user commands/hooks]
1. `git add . --update`
1. `git commit -m "[git.commitMessage]"`
1. `git tag --annotate --message="[git.tagAnnotation]" [git.tagName]`
1. `git push [git.pushArgs] [git.pushRepo]`

When not in CI mode, release-it will ask for confirmation before each of the commit, tag, and push steps.

Configure the `[git.*]` options to modify the commands accordingly. See
[all options and their default values](../config/release-it.json).

The minimum required version of Git is v2.0.0.

## Git remotes

SSH keys and Git remotes are assumed to be configured correctly. If a manual `git push` from the command line works,
release-it should be able to do the same.

The following help pages might be useful:

- [Connecting to GitHub with SSH](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [Managing remote repositories](https://docs.github.com/en/get-started/getting-started-with-git/managing-remote-repositories)
  (GitHub)
- [Configure SSH and two-step verification](https://support.atlassian.com/bitbucket-cloud/docs/configure-ssh-and-two-step-verification/)
  (Bitbucket)
- [GitLab and SSH keys](https://gitlab.com/help/ssh/README.md)

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
that this represents a glob (not a regex):

Example: `git.tagMatch: "[0-9]*\.[0-9]*\.[0-9]*"`

Or only `"[!-]*"`, as this would match everything that excludes a hyphen, which is normally used excusively in
pre-releaseses.

This could also be useful when using a plugin to determine the next tag:

Example: `git.tagMatch: "[0-9][0-9].[0-1][0-9].[0-9]*"`

## Extra arguments

In case extra arguments should be provided to Git, these options are available:

- `git.commitArgs`
- `git.tagArgs`
- `git.pushArgs`

For example, use `"git.commitArgs": ["-S"]` to sign commits (also see
[#35](https://github.com/release-it/release-it/issues/350)).

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
    "requireBranch": "master"
  }
}
```

Use an array to allow releases from more branch names. Wildcards are also allowed (e.g. `release/*`).

### Clean working directory

The working directory should be clean (i.e. `git status` should say something like this:

```bash
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

Use `--no-git.requireUpstream` to add `--set-upstream [remote] [branch]` to the `git push` command, where `[remote]` is
the value of `git.pushRepo` ("origin" by default, if no upstream branch), and `[branch]` is the name of the current
branch. So if the current branch is `next` then the full command that release-it will execute becomes
`git push --follow-tags --set-upstream origin next`.

Configure `pushRepo` with either a remote name or a Git url to push the release to that remote instead of `origin`.

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

## Further customizations

In case you need even more customizations, here is some inspiration:

```json
{
  "git": {
    "push": false
  },
  "hooks": {
    "after:git:release": "git push origin HEAD"
  }
}
```

Since the `after:release` hook runs after the Git commands, the `git.push` can be disabled, and replaced by a custom
script.
