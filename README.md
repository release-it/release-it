# Modified Release It!

Interactive release tool for Git repositories. Options: run build command first, release to distribution repository (or branch), create GitHub release, publish to npm.

Automatically bump version, commit, tag, push, done.

Here's an extended article about [Using Release It!](https://medium.com/@webprolific/using-release-it-60b96515c073)

![Release-It](https://webpro.github.com/release-it/Release-It.gif)

Obviously, **Release It** has released itself. Cool, heh?! There's also a [Grunt plugin](https://github.com/webpro/grunt-release-it).

## Install

```bash
npm install release-it -g
```

## Examples

Release a new patch (increments from e.g. `1.0.4` to `1.0.5`):

```bash
release-it
```

Release a patch, minor, major, or specific version:

```bash
release-it minor
release-it 0.8.3
release-it 2.0.0-rc.3
```

Create a pre-release using `prelease`, `prepatch`, `preminor`, or `premajor`:

```bash
release-it premajor --prereleaseId="beta"
release-it premajor
```

The first example would increment from e.g. `1.0.6` to `2.0.0-beta.0`, the second from `2.0.0-beta.0` to `2.0.0-beta.1`.

See [node-semver](https://github.com/npm/node-semver#readme) for more details.

You can also do a dry run, which won't write/touch anything, but does output the commands it would execute, and show the interactivity:

```bash
release-it --dry-run
```

If you don't like questions and trust the tool, you can use the `non-interactive` mode:

```bash
release-it --non-interactive
```

Provide a custom name for the GitHub release:

```bash
release-it --github.releaseName="Awesome Ants"
```

## Configuration

**Release It** can do a lot out-of-the-box, but has plenty of options to configure it.

### Help

```
$ release-it --help
Release It! v2.1.0

Usage: release <increment> [options]

Use e.g. "release minor" directly as shorthand for "release --increment=minor".

Options:
  -c, --config           Path to local configuration options [default: ".release.json"]                          
  -d, --dry-run          Do not touch or write anything, but show the commands and interactivity                 
  -e, --debug            Output exceptions                                                                       
  -f, --force            Force tagging with Git                                                                  
  -h, --help             Print help                                                                              
  -i, --increment        Increment "major", "minor", "patch", or "pre*" version; or specify version [default: "patch"]
  -m, --message          Commit message [default: "Release %s"]
  -n, --non-interactive  No interaction (assume default answers to questions)                                    
      --prereleaseId     Identifier for pre-releases (e.g. "beta" in "1.0.0-beta.1")
  -p, --npm.publish      Auto-publish to npm (only relevant in --non-interactive mode)
      --npm.tag          Register published package with given tag (default: "latest")
  -v, --version          Print version number                                                                    
  -V, --verbose          Verbose output
```

### Default Settings

```json
{
    "non-interactive": false,
    "dry-run": false,
    "verbose": false,
    "force": false,
    "pkgFiles": ["package.json"],
    "increment": "patch",
    "prereleaseId": null,
    "commitMessage": "Release %s",
    "tagName": "%s",
    "tagAnnotation": "Release %s",
    "buildCommand": false,
    "changelogCommand": "git log --pretty=format:'* %s (%h)' [REV_RANGE]",
    "requireCleanWorkingDir": false,
    "src": {
        "pushRepo": null,
        "beforeStartCommand": false,
        "beforeStageCommand": false,
        "afterReleaseCommand": false
    },
    "dist": {
        "repo": false,
        "stageDir": ".stage",
        "baseDir": "dist",
        "files": ["**/*"],
        "pkgFiles": null,
        "beforeStageCommand": false,
        "afterReleaseCommand": false
    },
    "npm": {
        "publish": false,
        "publishPath": ".",
        "tag": "latest",
        "private": false,
        "forcePublishSourceRepo": false
    },
    "github": {
        "release": false,
        "releaseName": "Release %s",
        "tokenRef": "GITHUB_TOKEN"
    }
}
```

Notes:

* If `src.pushRepo` has a falsey value, just `git push` is used. Otherwise, it's the url or name of a remote in `git push <src.pushRepo>`.
* If `dist.pkgFiles` has a falsey value, it will take the value of `pkgFiles`.
* The `after*/before*` commands are executed from the root/working directory of the source or distribution repository. The `beforeStageCommand` is executed before files are staged for commit, and after a version bump.

### Distribution Repository

Some projects use a special distribution repository. There might be multiple reasons to do.

* Distribute more "clean" file structures (without unrelated test, manifest, documentation files etc.).
* Distribute to target specific package managers. One example is the "shims" repositories in [https://github.com/components](https://github.com/components) (the actual source files are elsewhere).
* Distribute just documentation to a Github Pages branch. Also see [Using GitHub Pages, the easy way](https://medium.com/@webprolific/using-github-pages-the-easy-way-bb7acc46f45b).

Notes:

* To release to a separate "distribution repo", set `dist.repo` to a git endpoint (e.g. `"git@github.com:components/ember.git"`).
* Note that this can also be a branch, possibly of the same source repository, using `#` notation (e.g. `"git@github.com:webpro/release-it.git#gh-pages"`).
* In case you want to update `dist.repo`, but still want to publish the source repository to npm, make sure to set `"forcePublishSourceRepo": true`.

### GitHub

#### SSH keys & git remotes

The tool assumes you've configured your SSH keys and remotes correctly. In case you need to configure things for GitHub, the following pages might be of help.

* GitHub Help: [SSH](https://help.github.com/categories/56/articles)
* GitHub Help: [Managing Remotes](https://help.github.com/categories/18/articles)

#### GitHub release

To create [GitHub releases](https://help.github.com/articles/creating-releases/), you'll need to set `github.release` to `true`, get a [GitHub access token](https://github.com/settings/tokens), and make this available as the environment variable defined with `github.tokenRef`. With the default settings, you could set it like this:

```bash
export GITHUB_TOKEN="f941e0..."
```

In non-interactive mode, the release is created only for the source repository.

### Local configuration file

Place a `.release.json` file in your project root, and **Release It** will use it to overwrite default settings. You can use `--config` if you want to use another filename/location. Most options can be set on the command-line (these will have highest priority).

## What it does

To keep you in control, many steps need your confirmation before execution. This is what happens if you answer "Yes" to each question:

With the current repository:

1. Bump version in `pkgFiles`.
1. Is `buildCommand` provided? Clean `dist.baseDir` and execute the `buildCommand`.
1. Commit changes with `commitMessage` (`%s` is replaced with the new version).
1. Tag commit with `tagName` (and `tagAnnotation`).
1. Push commit and tag.
1. Create release on GitHub (with `github.releaseName` and output of `changelogCommand`).
1. No `dist.repo`? Publish package to npm.

Additionally, if a distribution repository is configured:

1. Clone `dist.repo` in `dist.stageDir`.
1. Copy `dist.files` from `dist.baseDir` to `dist.repo`.
1. Bump version in `dist.pkgFiles`, commit, tag, push `dist.repo`.
1. Create release on GitHub (with `github.releaseName` and output of `changelogCommand`).
1. Publish package to npm.

Notes:

* In the background, some steps of the distribution repo process are actually executed before you are asked to commit anything (even in the source repo), so you know about build, clone, or copy issues as soon as possible.
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
