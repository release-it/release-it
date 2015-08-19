# Release It!

Interactive release tool for Git repositories. Publish to npm. Optionally build and release to a distribution/component repository.

Automatically bump version, commit, tag, push, publish, done.

![Release-It](./Release-It.gif)

Obviously, **Release It** has released itself. Cool, heh?! There's also a [Grunt plugin](https://github.com/webpro/grunt-release-it).

## Install

```shell
npm install release-it -g
```

## Examples

Release a "patch" update (increments the `x` in `0.0.x` by one):

```shell
release-it
```

Release a patch, minor, major, or specific version:

```shell
release-it minor
release-it 0.8.3
release-it 2.0.0-rc.3
```

You can also do a dry run, which won't write/touch anything, but does output the commands it would execute, and show the interactivity:

```shell
release-it --dry-run
```

If you don't like questions and trust the tool, you can use the `non-interactive` mode:

```shell
release-it --non-interactive
```

Provide a custom name for the GitHub release:

```shell
release-it --githubReleaseName="Awesome Ants"
```

## Configuration

**Release It** can do a lot out-of-the-box, but has plenty of options to configure it.

### Help

```
$ release --help
Release It! v1.0.0

Usage: release <increment> [options]

Use e.g. "release minor" directly as shorthand for "release --increment=minor".

Options:
  -c, --config           Path to local configuration options [default: ".release.json"]                          
  -d, --dry-run          Do not touch or write anything, but show the commands and interactivity                 
  -e, --debug            Output exceptions                                                                       
  -f, --force            Force tagging with Git                                                                  
  -h, --help             Print help                                                                              
  -i, --increment        Incrementing "major", "minor", or "patch" version; or specify version [default: "patch"]
  -n, --non-interactive  No interaction (assume default answers to questions)                                    
  -p, --publish          Publish to npm (only in --non-interactive mode)                                         
  -v, --version          Print version number                                                                    
  -V, --verbose          Verbose output
```

### Default Settings

```js
{
    "non-interactive": false,
    "dry-run": false,
    "verbose": false,
    "force": false,
    "pkgFiles": ["package.json"],
    "increment": "patch",
    "commitMessage": "Release %s",
    "tagName": "%s",
    "tagAnnotation": "Release %s",
    "buildCommand": false,
    "distRepo": false,
    "distPkgFiles": null, /* Defaults to pkgFiles */
    "distStageDir": ".stage",
    "distBase": "dist",
    "distFiles": ["**/*"],
    "private": false,
    "publish": false,
    "publishPath": ".",
    "forcePublishSourceRepo": false,
    "githubTokenRef": "GITHUB_TOKEN",
    "githubRelease": false,
    "githubReleaseName": "Release %s",
    "githubReleaseBodyCommand": "git log --pretty=format:'* %s (%h)' [REV_RANGE]"
}
```

### Distribution Repository

Some projects use a special distribution repository. There might be multiple reasons to do.

* Distribute more "clean" file structures (without unrelated test, manifest, documentation files etc.).
* Distribute to target specific package managers. One example is the "shims" repositories in [https://github.com/components](https://github.com/components) (the actual source files are elsewhere).
* Distribute just documentation to a Github Pages branch.

Notes:

* To release to a separate "distribution repo", set `distRepo` to a git endpoint (e.g. `"git@github.com:components/ember.git"`).
* Note that this can also be a branch, possibly of the same source repository, using `#` notation (e.g. `"git@github.com:webpro/release-it.git#gh-pages"`).
* In case you want to update `distRepo`, but still want to publish the source repository to npm, make sure to set `"forcePublishSourceRepo": true`.

### GitHub

#### SSH keys & git remotes

The tool assumes you've configured your SSH keys and remotes correctly. In case you need to configure things for GitHub, the following pages might be of help.

* GitHub Help: [SSH](https://help.github.com/categories/56/articles)
* GitHub Help: [Managing Remotes](https://help.github.com/categories/18/articles)

#### GitHub release

To create [GitHub releases](https://help.github.com/articles/creating-releases/), you'll need to set `githubRelease` to `true`, get a [GitHub access token](https://github.com/settings/tokens), and make this available as the environment variable defined with `githubTokenRef`. With the default settings, you could set it like this:

```shell
export GITHUB_TOKEN="f941e0..."
```

### Local overrides

Place a `.release.json` file in your project root, and **Release It** will use it to overwrite default settings. You can use `--config` if you want to use another filename/location. Most options can be set on the command-line (these will have highest priority).

## What it does

To keep you in control, many steps need your confirmation before execution. This is what happens if you answer "Yes" to each question:

With the current repository:

1. Bump version in `pkgFiles`.
1. Commit changes with `commitMessage` (`%s` is replaced with the new version).
1. Tag commit with `tagName` (and `tagAnnotation`).
1. Push commit and tag.
1. Create release on GitHub (with `githubReleaseName` and output of `githubReleaseBodyCommand`).
1. No `distRepo`? Publish package to npm.

Additionally, if a distribution repository is configured:

1. Clean `distBase` and execute the `buildCommand`.
1. Clone `distRepo` in `distStageDir`.
1. Copy `distFiles` from `distBase` to `distRepo`.
1. Bump version, commit, tag, push `distRepo`.
1. Published package to npm.

Notes:

* The first 3 steps of the `distRepo` process are actually executed before you are asked to commit anything (even in the source repo), so you know about build, clone, or copy issues as soon as possible.
* If present, your `"private": true` setting in package.json will be respected and you will not be bothered with the question to publish to npm.

## Credits

Major dependencies:

* [ShellJS](http://documentup.com/arturadib/shelljs)
* [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)
* [node-github](https://github.com/mikedeboer/node-github)

The following Grunt plugins have been a source of inspiration:

* [grunt-release](https://github.com/geddski/grunt-release)
* [grunt-release-component](https://github.com/walmartlabs/grunt-release-component)

## Why YA...

Why did I need to create yet another "release" tool/plugin? I think this tool stands out:

* As a user-friendly, stand-alone CLI tool.
* Making it simple to release the current project you're working at.
* Working without any configuration, but also provides many options.
* Releasing a separate distribution repository (in a single run).
* Being as quiet or verbose as you want it to be.

## License

[MIT](http://webpro.mit-license.org/)
