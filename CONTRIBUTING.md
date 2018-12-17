# Contribution Guidelines

First of all, thanks for thinking of contributing to this project! 👏

This project has a [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## ❤️ Ways to Contribute

* Blog or tweet about the project
* Improve documentation
* Fix a bug
* Implement a new feature
* Discuss potential ways to improve project
* Improve existing implementation, performance, etc.

## 🛎 Questions

Feel free to open a ticket with your question.

Please put some effort in requesting a new feature. If someone else is going to implement something, the least you can do is describe the feature in detail, and why it would be useful to others as well.

## 🐛 File a Bug

In case you've encountered a bug, please make sure:

* You are using the [latest version](https://github.com/webpro/release-it/releases).
* You have read the [documentation](https://github.com/webpro/release-it/blob/master/README.md) first, and double-checked your configuration.
* You have acknowledged from `--verbose` and `--debug` the errors are likely a bug in this project (and not coming from your environment or a dependency of this project).
* In your issue description, please include:
	* What you expected to see, and what happened instead.
	* Your operating system and other environment information.
	* As much information as possible, such as the command and configuration used.
	* Interesting logs with `--verbose` and/or `--debug`.
	* All steps to reproduce the issue.

## 🎁 Pull Requests

Pull requests are welcome! Please keep the following in mind:

* See below for instructions on how to set up the project on your machine.
* To match the existing code styling, use `npm run prettier` before committing code.
* Make sure the tests pass (run `npm test`). Your changes probably deserve new tests as well.
* Remember that this project is cross-platform compatible (macOS, Windows, Linux), and that it runs in different versions of Node.

Unsure about whether you should open a pull request? Feel free to discuss it first in a ticket.

Set up the project on your machine:

First fork the the project on [GitHub](https://github.com/webpro/release-it).

```bash
git clone https://github.com/<your-github-username>/release-it
cd release-it
npm install
```

Setup the upstream to the original repo to stay in sync with it:

```bash
# Copy the URI from the original repo you forked and use it here
$ git remote add upstream git://github.com/<forked-from-user>/<forked-from-repo>.git
$ git fetch upstream
```

Sync with the original repo:

```bash
# Execute the following command to do the actual sync, which is like a "git pull" meaning it does a fetch + merge
$ git merge upstream/master master
# Or better, replay your local work on top of the fetched branch, which is like a "git pull --rebase"
$ git rebase upstream/master
```

**Pro tip**: Always sync with the original repo before submitting a pull request to make sure your changes are working with the latest code base!

Verify the tests are passing:

```
npm test
```

To make release-it globally available so you can run it on your (test) project:

```
npm link
```

To test locally, e.g. disabling the distribution repository (`--no-dist.repo`) and clean working directory requirement (`--no-git.requireCleanWorkingDir`):

```
node bin/release-it --dry-run --verbose --no-dist.repo --no-git.requireCleanWorkingDir
```
