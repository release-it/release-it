# Require Commits

By default, release-it does not check the number of commits upfront. Configure `"git.requireCommits": true` to exit the
release-it process if there are no commits since the latest tag.

It is a good idea to verify things are working properly (e.g. by running tests) before releasing the project. However,
the check enabled by `git.requireCommits` occurs after `scripts.beforeStart` (as the former is part of the Git plugin).
In case time-consuming scripts are defined in `scripts.beforeStart` and things should be sped up, consider using
something like this:

```json
{
  "scripts": {
    "beforeStart": [
      "if [ \"$(git log $(git describe --tags --abbrev=0)..HEAD)\" = \"\" ]; then exit 1; fi;",
      "npm test"
    ]
  }
}
```

Or even take it upfront like this:

```shell
[ "$(git rev-list $(git describe --tags --abbrev=0)..HEAD --count)" = "0" ] || release-it
```
