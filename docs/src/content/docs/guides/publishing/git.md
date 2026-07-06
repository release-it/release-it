---
title: Git
description: How release-it's built-in Git plugin stages, commits, tags and pushes releases — plus prerequisites, custom tag names, and skip switches.
---

The Git plugin is enabled whenever the current directory contains a `.git` folder. By default,
it performs these steps:

1. [Prerequisite checks](#prerequisite-checks)
2. _(files may be updated by other plugins or your `after:bump` hook)_
3. `git add . --update`
4. `git commit -m "[git.commitMessage]"`
5. `git tag --annotate --message="[git.tagAnnotation]" [git.tagName]`
6. `git push [git.pushArgs] [git.pushRepo]`

Outside CI mode, release-it prompts for confirmation before each of the commit, tag, and push
steps.

The minimum required Git version is **2.0.0**.

For the full list of `git.*` options, see
[Configuration options → Git](/release-it/reference/configuration-options/git/).

## Git remotes

SSH keys and Git remotes are assumed to be configured correctly. If a manual `git push` from
your command line works, release-it can do the same.

Useful references:

- [Connecting to GitHub with SSH](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [Managing remote repositories](https://docs.github.com/en/get-started/getting-started-with-git/managing-remote-repositories)
- [Configure SSH and two-step verification](https://support.atlassian.com/bitbucket-cloud/docs/configure-ssh-and-two-step-verification/)
  (Bitbucket)
- [GitLab and SSH keys](https://docs.gitlab.com/user/ssh/)

## Remote repository

By default, release-it uses the current branch's tracking information. Without it, it falls back
to `origin`. Override with `git.pushRepo`:

```json
{
  "git": {
    "pushRepo": "upstream"
  }
}
```

Any Git URL works too, not just a remote name.

## Custom tag name

Use `git.tagName` to shape the tag. When the latest existing tag has a `v` prefix, release-it
keeps it automatically — you don't need to declare `git.tagName: "v${version}"`.

Examples:

- `--git.tagName=${branchName}-${version}`
- `--git.tagName=${repo.project}-${version}`
- `--git.tagName=${npm.name}@${version}`

## Matching / excluding tags

`git.tagMatch` and `git.tagExclude` override how release-it locates the _previous_ tag. Note:
these are [glob patterns](https://code.visualstudio.com/docs/editor/glob-patterns), not regex.

Match only stable-looking tags:

```json
{
  "git": {
    "tagMatch": "[0-9]*.[0-9]*.[0-9]*"
  }
}
```

Exclude pre-releases (anything with a `-` in the name):

```json
{
  "git": {
    "tagExclude": "*[-]*"
  }
}
```

`tagExclude` has no effect when [`getLatestTagFromAllRefs`](#use-all-refs-to-determine-latest-tag)
is on.

## Use all refs to determine latest tag

By default, release-it uses [`git describe`](https://git-scm.com/docs/git-describe), which finds
the most recent tag reachable from the current commit. Set
`git.getLatestTagFromAllRefs: true` to consider _every_ tag, sorted by version:

<img
  src="/release-it/git-version-from-all-refs.svg"
  alt="Determine latest tag from all refs"
  class="light-only"
/>
<img
  src="/release-it/git-version-from-all-refs-dark.svg"
  alt="Determine latest tag from all refs"
  class="dark-only"
/>

In this example, releasing from `develop`:

- `getLatestTagFromAllRefs: false` (default) → latest tag reachable from `develop` is
  `v1.1.0-rc1`, so the next version is `v1.1.0-rc2`.
- `getLatestTagFromAllRefs: true` → the highest tag is `v1.1.0` on `main`, so the next
  version becomes `v1.2.0-rc1`.

## Extra arguments to Git

- `git.commitArgs`
- `git.tagArgs`
- `git.pushArgs`

For example, GPG-sign every release commit (also see
[#35](https://github.com/release-it/release-it/issues/350)):

```json
{
  "git": {
    "commitArgs": ["-S"]
  }
}
```

`["--follow-tags"]` is the default for `pushArgs`. If you override it, re-add `--follow-tags`
manually.

Multiple args at the command line:

```bash
release-it minor --git.pushArgs=--follow-tags --git.pushArgs=--force
```

## Skipping steps

Skip Git entirely (for example, when only `npm publish` is needed):

```bash
release-it --no-git
```

Or a single step: `--no-git.tag`, `--no-git.push`, `--no-git.commit`.

## Untracked files

By default, untracked files are excluded from the release commit. Enable them with
`git.addUntrackedFiles: true`.

## Prerequisite checks

### Required branch

Off by default. Enable to fail the release when run from the wrong branch:

```json
{
  "git": {
    "requireBranch": "main"
  }
}
```

An array allows multiple branches, and wildcards work: `release/*`.

### Clean working directory

release-it refuses to run unless `git status` reports a clean tree. If your workflow needs to
include currently-staged changes in the release commit, disable the check with
`--no-git.requireCleanWorkingDir` or `git.requireCleanWorkingDir: false`.

### Upstream branch

If Git doesn't know an upstream, release-it can't push and stops. Use
`--no-git.requireUpstream` to add `--set-upstream <remote> <branch>` to the `git push` command
instead — the full command becomes `git push --follow-tags --set-upstream origin <branch>`.

Typical use case: releasing a hotfix from a new backport branch.

### No commits

Off by default. Turn it on to abort empty releases:

```json
{
  "git": {
    "requireCommits": true
  }
}
```

Also see the [Require Commits recipe](/release-it/guides/recipes/require-commits/).

## Further customisation

Combining `git.push: false` with a custom `after:release` hook lets you script your own push:

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
