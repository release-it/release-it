# Git

The Git plugin in release-it, by default, does the following:

1. [Prerequisite checks](./prerequisites.md#git)
1. [Files may be updated by other plugins and/or user commands/hooks]
1. `git add . --update`
1. `git commit -m "[git.commitMessage]"`
1. `git tag --annotate --message="[git.tagAnnotation]" [git.tagName]`
1. `git push [git.pushArgs] [git.pushRepo]`

When not in CI mode, release-it will ask for confirmation before each of the commit, tag, and push steps.

Configure the `[git.*]` options to modify the commands accordingly. See
[all options and their default values](../config/release-it.json).

## SSH keys & Git remotes

SSH keys and Git remotes are assumed to be configured correctly. If a manual `git push` from the command line works,
release-it should be able to do the same.

The following help pages might be useful:

- [SSH](https://help.github.com/articles/connecting-to-github-with-ssh/)
- [Managing Remotes](https://help.github.com/categories/managing-remotes/) (GitHub)
- [SSH keys](https://confluence.atlassian.com/bitbucket/ssh-keys-935365775.html) (Bitbucket)
- [SSH keys](https://gitlab.com/help/ssh/README.md) (GitLab)

## Remote repository

By default, `release-it` uses branch's tracking information, unless there isn't any, in which case it
defaults to `"origin"` as the remote name to push to. Use `git.pushRepo` to override this with a
different remote name, or a different git url.

## Extra arguments

In case extra arguments should be provided to Git, these options are available:

- `git.commitArgs`
- `git.tagArgs`
- `git.pushArgs`

For example, use `"git.commitArgs": ["-S"]` to sign commits (also see
[#35](https://github.com/release-it/release-it/issues/350)).

## Skip Git steps

To skip the Git steps entirely (for instance, if you only want to `npm publish`), this shorthand is available:

```bash
release-it --no-git
```

Use e.g. `git.tag: false` or `--no-git.tag` to skip a single step.

## Untracked files

By default, untracked files are not added to the release commit. Use `git.addUntrackedFiles: true` to override this
behavior.

## Further custimizations

In case you need even more freedom, here is some inspiration:

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

Since the `after:git:release` hook runs after the Git commands, the `git.push` can be disabled, and replaced by a custom
script.
