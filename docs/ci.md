# Continuous Integration environments

As release-it is increasingly used from CI/CD environments such as Travis, Circle CI or GitHub Actions, this page
outlines some popular ways to configure this. Do you have additional successful integrations, or experiencing issues
with the existing ones below, feel free to [open a ticket][1].

## Contents

- [Git][2]
- [GitHub Actions][3]
- [npm][4]
- [GitHub & GitLab Releases][5]
- [GitLab CI][6]

## Git

In order to push the release commit and tag back to the remote, the CI/CD environment should be authenticated with the
original host (e.g. GitHub). Also see [Git][7].

### SSH (recommended)

When using an `SSH` url (such as `git@github.com:user/repo.git`), add the public key to the CI/CD environment.

### HTTPS

When using an `HTTPS` url (such as `https://github.com/user/project.git`), things are slightly more complicated. For
GitHub, add the `GITHUB_TOKEN` token to the CI/CD environment. Then make sure to add this token as a password in the
origin url before running release-it. An example is this `.travis.yml` section:

```yaml
script:
  - git remote rm origin
  - git remote add origin https://[user]:${GITHUB_TOKEN}@github.com/[user]/[project].git
  - git symbolic-ref HEAD refs/heads/main
```

Replace `[user]` and `[project]` with the actual values.

## GitHub Actions

To run release-it from a GitHub Action, here's an example job (fragment) to configure a Git user (to push the release
commit), and expose `NPM_TOKEN` for publishing to the npm registry and `GITHUB_TOKEN` for the GitHub Release:

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
      - name: git config
        run: |
          git config user.name "${GITHUB_ACTOR}"
          git config user.email "${GITHUB_ACTOR}@users.noreply.github.com"
      - run: npm install
      - run: npm run release
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The `fetch-depth: 0` option is only necessary when the Git history is required e.g. if using a plugin such as
[@release-it/conventional-changelog][8].

If you enjoy watching a video, [David from Kodaps][9] created a great walk-through including setting up npm and GitHub
tokens: [How to use GitHub Actions & Release-It to Easily Release Your Code][10]

## npm

To publish a package to the (or any) npm registry from within a CI or CD environment such as Travis or Circle, make the
`NPM_TOKEN` available in the `.npmrc` file. This file should look like this before release-it attempts to publish the
package:

```text
//registry.npmjs.org/:_authToken=$NPM_TOKEN
```

One way to achieve this is to set the `NPM_TOKEN` in the CI environment, and from a script do:

```bash
npm config set //registry.npmjs.org/:_authToken $NPM_TOKEN
```

This will create/update the `.npmrc` file and add the token there. Ideally you should either `.gitignore` this file,
otherwise you might end up committing it to your repo if you are using release-it's `git` options.

Since release-it executes `npm whoami` as a [prerequisite check][11], which does not seem to respect the `.npmrc` file,
the `--npm.skipChecks` argument can be used.

- [Creating and viewing authentication tokens][12]
- [Using (private) packages in a CI/CD workflow][13]

### Travis

Here's an example fragment of what to add to `.travis.yml`:

```yaml
deploy:
  script:
    - echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
    - npm run release
```

### Circle

In short, here's the relevant fragment from `.circleci/config.yml`:

```yaml
jobs:
  deploy:
    steps:
      - attach_workspace:
          at: ~/repo
      - run:
          name: Authenticate with registry
          command: npm config set //registry.npmjs.org/:_authToken $NPM_TOKEN
```

During the release process, your project's `package.json` will be updated to bump the version. You will need to setup
CircleCI with a non read-only SSH key pair from your Github account if you want it to be able to push that change back
to the repo.

See [Publishing npm Packages Using CircleCI][14] for more details.

## GitHub & GitLab Releases

Make sure the `GITHUB_TOKEN` or `GITLAB_TOKEN` environment variable is set in the CI/CD environment to publish (or
draft) [GitHub][15] or [GitLab releases][16]. This works the same as on your local machine.

## GitLab CI

### SSH (recommended)

When using release-it with GitLab CI and SSH, make sure the following requirements are met:

- `git` and `ssh` as packages are installed in the job
- `npm install` is run beforehand
- Environment variables contain `GITLAB_TOKEN`, `SSH_PRIVATE_KEY`, `CI_EMAIL` and `CI_USER`
- A user with permissions to write to protected branches or deploy key (env var) is added to the repo

### Alpine

The following example shows a pipeline that first installs Git and OpenSSH to Alpine, adds the SSH private key to the
SSH agent, configures SSH, and eventually executes release-it:

```yaml
before_script:
  - apk add --no-cache git openssh
  - eval `ssh-agent -s`
  - echo "${SSH_PRIVATE_KEY}" | tr -d '\r' | ssh-add - > /dev/null # add ssh key
  - mkdir -p ~/.ssh
  - chmod 700 ~/.ssh
  - '[[ -f /.dockerenv ]] && echo -e "Host *\n\tStrictHostKeyChecking no\n\n" > ~/.ssh/config'
  - git checkout $CI_COMMIT_REF_NAME
  - git remote set-url origin "git@gitlab.com:$CI_PROJECT_PATH.git"
  - git config --global user.name "${CI_USERNAME}"
  - git config --global user.email "${CI_EMAIL}"
  - npm install
script:
  - npx release-it --ci
```

Note: the `git remote set-url` could also be set with the `git.pushRepo` option in the release-it configuration.

### Error: tag already exists

Some people have reported an issue when using GitLab CI (in [#573][17]):

> ERROR fatal: tag vX.X.X already exists

Here is an example script sequence for GitLab to mitigate the issue:

```bash
- git pull origin $CI_COMMIT_REF_NAME
- npm run release
```

Specifically, make sure to `fetch` with the `--prune-tags` argument before release-it tries to create the Git tag:

```json
{
  "hooks": {
    "before:init": "git fetch --prune --prune-tags origin"
  }
}
```

[1]: https://github.com/release-it/release-it/issues
[2]: #git
[3]: #github-actions
[4]: #npm
[5]: #github--gitlab-releases
[6]: #gitlab-ci
[7]: ./git.md
[8]: https://github.com/release-it/conventional-changelog
[9]: https://twitter.com/KodapsAcademy
[10]: https://www.youtube.com/watch?v=7pBcuT7j_A0
[11]: ./npm.md#prerequisite-checks
[12]: https://docs.npmjs.com/creating-and-viewing-authentication-tokens
[13]: https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow
[14]: https://circleci.com/blog/publishing-npm-packages-using-circleci-2-0/
[15]: https://github.com/release-it/release-it#github-releases
[16]: https://github.com/release-it/release-it#gitlab-releases
[17]: https://github.com/release-it/release-it/issues/573
