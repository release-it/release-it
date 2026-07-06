---
title: CI environments
description: Run release-it inside GitHub Actions, GitLab CI, Travis and CircleCI — SSH vs HTTPS, tokens, .npmrc, and provider-specific gotchas.
---

release-it detects Continuous Integration environments and switches to non-interactive mode
automatically — you can also force it with `--ci`. This page covers the practical setup for
the major providers.

If something's missing or broken here, please
[open a ticket](https://github.com/release-it/release-it/issues).

## Git

To push the release commit and tag, the CI environment must be authenticated with your Git
host. See also [Git](/release-it/guides/publishing/git/).

### SSH (recommended)

For an SSH URL (`git@github.com:user/repo.git`), add the CI's public key to your Git host.

### HTTPS

For an HTTPS URL (`https://github.com/user/project.git`) with a `GITHUB_TOKEN`, embed the token
in the remote URL before running release-it. Travis example:

```yaml
script:
  - git remote rm origin
  - git remote add origin https://[user]:${GITHUB_TOKEN}@github.com/[user]/[project].git
  - git symbolic-ref HEAD refs/heads/main
```

Substitute your `[user]` and `[project]`.

## GitHub Actions

A working job — configures the Git identity, installs deps, exposes `NPM_TOKEN` and
`GITHUB_TOKEN`:

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: git config
        run: |
          git config user.name  "${GITHUB_ACTOR}"
          git config user.email "${GITHUB_ACTOR}@users.noreply.github.com"
      - run: npm install
      - run: npm run release
        env:
          NPM_TOKEN:    ${{ secrets.NPM_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`fetch-depth: 0` is only necessary if a plugin needs the full history (e.g.
[@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog)).

Video walk-through by [David from Kodaps](https://twitter.com/KodapsAcademy):
[How to use GitHub Actions & Release-It to Easily Release Your
Code](https://www.youtube.com/watch?v=7pBcuT7j_A0).

For token-free npm publishing, see
[Trusted Publishing (OIDC)](/release-it/guides/publishing/npm/#trusted-publishing-oidc).

## npm authentication

To publish from CI, expose `NPM_TOKEN` and write it into `.npmrc` before publish:

```text
//registry.npmjs.org/:_authToken=$NPM_TOKEN
```

The easiest way:

```bash
npm config set //registry.npmjs.org/:_authToken $NPM_TOKEN
```

Add `.npmrc` to `.gitignore` — otherwise release-it's Git plugin may commit it.

release-it runs `npm whoami` as a [prerequisite check](/release-it/guides/publishing/npm/#prerequisite-checks)
that doesn't always respect `.npmrc`. If it fails, pass `--npm.skipChecks`.

Reference reading:

- [Creating and viewing authentication
  tokens](https://docs.npmjs.com/creating-and-viewing-authentication-tokens)
- [Using private packages in a CI/CD
  workflow](https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow)

### Travis

`.travis.yml` fragment:

```yaml
deploy:
  script:
    - echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
    - npm run release
```

### CircleCI

`.circleci/config.yml` fragment:

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

For CircleCI to push the release commit back, configure it with a non-read-only SSH deploy
key. Full walk-through: [Publishing npm Packages Using
CircleCI](https://circleci.com/blog/publishing-npm-packages-using-circleci-2-0/).

## GitHub & GitLab releases

Set the `GITHUB_TOKEN` or `GITLAB_TOKEN` environment variable in the CI environment to publish
(or draft) [GitHub](/release-it/guides/publishing/github-releases/) or
[GitLab releases](/release-it/guides/publishing/gitlab-releases/) — same as locally.

## GitLab CI

### SSH (recommended)

Requirements:

- `git` and `ssh` installed in the job.
- `npm install` run beforehand.
- Env vars: `GITLAB_TOKEN`, `SSH_PRIVATE_KEY`, `CI_EMAIL`, `CI_USER`.
- A user with permission to push to protected branches — or a deploy key.

### Alpine example

```yaml
before_script:
  - apk add --no-cache git openssh
  - eval `ssh-agent -s`
  - echo "${SSH_PRIVATE_KEY}" | tr -d '\r' | ssh-add - > /dev/null
  - mkdir -p ~/.ssh
  - chmod 700 ~/.ssh
  - '[[ -f /.dockerenv ]] && echo -e "Host *\n\tStrictHostKeyChecking no\n\n" > ~/.ssh/config'
  - git checkout $CI_COMMIT_REF_NAME
  - git remote set-url origin "git@gitlab.com:$CI_PROJECT_PATH.git"
  - git config --global user.name  "${CI_USERNAME}"
  - git config --global user.email "${CI_EMAIL}"
  - npm install
script:
  - npx release-it --ci
```

The `git remote set-url` step can also be replaced with `git.pushRepo` in the release-it
configuration.

### Error: tag already exists

Some pipelines (see [#573](https://github.com/release-it/release-it/issues/573)) hit:

> ERROR fatal: tag vX.X.X already exists

Mitigate by pulling and pruning tags first:

```bash
- git pull origin $CI_COMMIT_REF_NAME
- npm run release
```

Or as a hook:

```json
{
  "hooks": {
    "before:init": "git fetch --prune --prune-tags origin"
  }
}
```
