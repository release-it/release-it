# Require Commits

By default, release-it does not check the number of commits upfront. Configure `"git.requireCommits": true` to exit the
release-it process if there are no commits since the latest tag.

### Using `hooks.before:init` as well?

It is a good idea to verify things are working properly (e.g. by running tests) before releasing the project. However,
the check enabled by `git.requireCommits` occurs after `hooks.before:init` (as the former is part of the Git plugin). In
case time-consuming scripts are defined in `hooks.before:init` and things should be sped up, consider either moving the
scripts to `hooks.after:init`, or adding a custom shell script like this:

```json
{
  "hooks": {
    "before:init": [
      "if [ \"$(git log $(git describe --tags --abbrev=0)..HEAD)\" = \"\" ]; then exit 1; fi;",
      "npm test"
    ]
  }
}
```

Or even take it upfront like this:

```bash
[ "$(git rev-list $(git describe --tags --abbrev=0)..HEAD --count)" = "0" ] || release-it
```
