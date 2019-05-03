# Require Commits

By default, release-it does not check the number of commits upfront. Configure `"git.requireCommits": true` to exit the
release-it process if there are no commits since the latest tag.

It is a good idea to verify is working properly (e.g. by running tests) before releasing the project. However, in the
process the `git.requireCommits` check occurs after `scripts.beforeRelease` (as it is part of the Git plugin). In case
you have time-consuming scripts defined in `scripts.beforeStart` and want to speed things up, you could do something
like this:

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
