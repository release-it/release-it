---
title: git-cliff recipe
description: Configure release-it with git-cliff to generate customisable Conventional Commit-based changelogs, with a monorepo-aware option.
sidebar:
  label: git-cliff
  order: 3
---

Full git-cliff docs: [github.com/orhun/git-cliff](https://github.com/orhun/git-cliff).

## Install

```bash
npm install --save-dev git-cliff
```

## Why a shell wrapper?

git-cliff derives the tag from a `--tag` argument. release-it lets the user pick the next
version interactively, so the changelog should read the version _after_ release-it has bumped
`package.json`. A tiny wrapper script bridges the two:

```sh
#!/usr/bin/env bash
# ./changelog.sh

NODE_VERSION=$(node -p -e "require('./package.json').version")

if [ "$1" = "stdout" ]; then
    npm exec git-cliff -o - --unreleased --tag $NODE_VERSION
else
    npm exec git-cliff -o './CHANGELOG.md' --tag $NODE_VERSION
fi
```

## Wire it into release-it

```json
{
  "hooks": {
    "after:bump": "./changelog.sh"
  },
  "github": {
    "releaseNotes": "./changelog.sh stdout"
  }
}
```

## Template

git-cliff uses [Tera](https://keats.github.io/tera/) — inspired by Jinja2 and Django.
See the [git-cliff templating docs](https://git-cliff.org/docs/templating/examples) for
examples.

## Monorepos

`--include-path` scopes changes to a directory:
[git-cliff monorepo docs](https://git-cliff.org/docs/usage/monorepos).
