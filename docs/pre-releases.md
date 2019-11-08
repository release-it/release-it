# Manage pre-releases

With release-it, it's easy to create pre-releases: a version of your software that you want to make available, while
it's not in the stable semver range yet. Often "alpha", "beta", and "rc" (release candidate) are used as identifier for
pre-releases.

An example. The `awesome-pkg` is at version 1.3.0, and work is done for a new major update. To publish the latest beta
of the new major version:

```bash
release-it major --preRelease=beta
```

This will tag and release version `2.0.0-beta.0`. Notes:

- A normal installation of `awesome-pkg` will still be at version 1.3.0.
- The [npm tag](https://docs.npmjs.com/cli/dist-tag) will be "beta", install it using `npm install awesome-pkg@beta`
- A GitHub release will be marked as a "Pre-release".

The above command is actually a shortcut for:

```bash
release-it premajor --preReleaseId=beta --npm.tag=beta --github.preRelease
```

Consecutive beta releases (`2.0.0-beta.1` and so on):

```bash
release-it --preRelease
```

And when ready to release the next phase (e.g. release candidate, in this case `2.0.0-rc.0`):

```bash
release-it --preRelease=rc
```

And eventually, for `2.0.0`:

```bash
release-it major
```

<img src="./assets/release-it-prerelease.gif?raw=true" height="524">

Notes:

- Pre-releases work in tandem with [recommended bumps](https://github.com/release-it/conventional-changelog).
- You can still override individual options, e.g. `release-it --preRelease=rc --npm.tag=next`.
- See [semver.org](http://semver.org) for more details about semantic versioning.
