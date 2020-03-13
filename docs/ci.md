# Continuous Integration environments

As release-it is increasingly used from CI/CD environments such as Travis or Circle CI, this page outlines some popular
ways to configure this. Do you have additional successful integrations, or experiencing issues with the existing ones
below, feel free to [open a ticket](https://github.com/release-it/release-it/issues).

## Contents

- [Git](#git)
- [npm](#npm)
- [GitHub & GitLab Releases](#github--gitlab-releases)

## Git

In order to push the release commit and tag back to the remote, the CI/CD environment should be authenticated with the
original host (e.g. GitHub). Also see [release-it#git](https://github.com/release-it/release-it#git).

### SSH (recommended)

When using an `SSH` url (such as `git@github.com:user/repo.git`), add the public key to the CI/CD environment.

### HTTPS

When using an `HTTPS` url (such as `https://github.com/user/project.git`), things are slightly more complicated. Add the
token (e.g. `GITHUB_TOKEN`) to the CI/CD environment. Then make sure to add this token as a password in the origin url
before running release-it. E.g. add this to a .travis.yml` script section:

```yaml
script:
  - git remote rm origin
  - git remote add origin https://[user]:${GITHUB_TOKEN}@github.com/[user]/[project].git
  - git symbolic-ref HEAD refs/heads/master
```

Replace `[user]` and `[project]` with the correct strings.

## npm

To publish a package to the (or any) npm registry from within a CI or CD environment such as Travis or Circle, make the
`NPM_TOKEN` available in the `.npmrc` file. This file should look like this before release-it attempts to publish the
package:

```
//registry.npmjs.org/:_authToken=$NPM_TOKEN
```

One way to achieve this is to set the `NPM_TOKEN` in the CI environment, and from a script do:

```bash
echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
```

- [Creating and viewing authentication tokens](https://docs.npmjs.com/creating-and-viewing-authentication-tokens)
- [Using (private) packages in a CI/CD workflow](https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow)

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
          command: echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > ~/repo/.npmrc
```

See [Publishing npm Packages Using CircleCI](https://circleci.com/blog/publishing-npm-packages-using-circleci-2-0/) for
more details.

## GitHub & GitLab Releases

Make sure the `GITHUB_TOKEN` or `GITLAB_TOKEN` environment variable is set in the CI/CD environment to publish (or
draft) [GitHub](https://github.com/release-it/release-it#github-releases) or
[GitLab releases](https://github.com/release-it/release-it#gitlab-releases). This works the same as on your local
machine.
