# Release It!

Interactive release tool for Git repositories. Publish to npm. Optionally build and release to a distribution/component repository.

Automatically increments version in package.json, commit, tag, push, publish, done.

![Release-It](./Release-It.gif)

Obviously, **Release It** has released itself. Cool, heh?! There's also a [Grunt plugin](https://github.com/webpro/grunt-release-it).

## Install

```shell
npm install release-it -g
```

Personally, I prefer to alias it to `release`:

```shell
alias release="release-it"
```

The examples below assume this alias to be defined.

## Configuration

**Release It** can do a lot out-of-the-box, but has plenty of options to configure it.

### Help

```
$ release --help
Release It! v0.0.9

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
    "distStageDir": ".stage",
    "distBase": "dist",
    "distFiles": ["**/*"],
    "publish": false
}
```


If you also want to release to "distribution repo", you'll need to set `distRepo` to a git endpoint (e.g. `'git@github.com:webpro/awesome-component.git'`).

### Overrides

Place a `.release.json` file and **Release It** will use it to overwrite default settings. You can use `--config` if you want to use another filename/location. Most options can be set on the command-line (these will have highest priority).

### Notes

The tool assumes you've configured your SSH keys and remotes correctly. In case you need to configure things, the following pages might be of help.

* GitHub Help: [SSH](https://help.github.com/categories/56/articles)
* GitHub Help: [Managing Remotes](https://help.github.com/categories/18/articles)

## What it does

Many steps need your confirmation before execution.

By default, with the current repository:

1. The version in each of the `pkgFiles` will be incremented.
1. This change will be committed with `commitMessage`.
1. This commit is tagged with `tagName` (and `tagAnnotation`). The `%s` is replaced with the incremented version.
1. Both the commit and tag are pushed.
1. Without a configured `distRepo`, the package is published to npm.

Additionally, if a distribution repository is configured:

1. The plugin will create the distribution build using the `distBuildTask` shell command.
1. The `distRepo` is cloned in `distStageDir`.
1. The `distFiles` are copied here (normalized by removing the `distBase` from the target path).
1. Steps 1-4 above are executed for the distribution repository.
1. The package is published to npm.

## Usage examples

Release a "patch" update (increments the `x` in `0.0.x` by one):

```shell
release
```

Release a patch, minor, major, or specific version:

```shell
release minor
release 0.8.3
release 2.0.0-rc.3
```

You can also do a dry run, which won't write/touch anything, but does output the commands it would execute, and show the interactivity:

```shell
release --dry-run
```

If you don't like questions and trust the tool, you can use the `non-interactive` mode:

```shell
release --non-interactive
```

## Credits

This tool uses [ShellJS](http://documentup.com/arturadib/shelljs) and [Inquirer.js](https://github.com/SBoudrias/Inquirer.js), two awesome projects that you need to check out anyway.

The following Grunt plugins have been a source of inspiration:

* [grunt-release](https://github.com/geddski/grunt-release)
* [grunt-release-component](https://github.com/walmartlabs/grunt-release-component)

Why did I need to create yet another "release" tool/plugin? I think it..

* Should be a stand-alone CLI tool.
* Should be simple to release the current project you're working at.
* Should allow to release a separate distribution repository.
* Should be as quiet or verbose as you want it to be.

## License

[MIT](http://webpro.mit-license.org/)

![Analytics](https://ga-beacon.appspot.com/UA-17415234-3/release-it/readme?pixel)
