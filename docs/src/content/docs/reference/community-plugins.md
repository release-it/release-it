---
title: Community plugins
description: Third-party release-it plugins — changelog generators, alternate publishing targets, monorepo helpers, and more.
---

release-it has a plugin ecosystem. Below is a curated list of community-maintained plugins.
For the "how" of writing your own, see the [Plugin API](/release-it/reference/plugin-api/) and
the [Custom version plugin recipe](/release-it/guides/recipes/custom-version-plugin/).

Every plugin tagged
[`release-it-plugin` on npm](https://www.npmjs.com/search?q=keywords:release-it-plugin) also
shows up in that search.

## Plugins

| Plugin                                                                                          | What it does                                                                                                                                                 |
| :---------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@release-it/bumper](https://github.com/release-it/bumper)                                      | Read/write the version from/to any file                                                                                                                      |
| [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog)      | Recommended bump + Conventional Changelog + `CHANGELOG.md` updates                                                                                           |
| [@release-it/keep-a-changelog](https://github.com/release-it/keep-a-changelog)                  | Maintain `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com)                                                                             |
| [@release-it-plugins/lerna-changelog](https://github.com/release-it-plugins/lerna-changelog)    | Integrate lerna-changelog                                                                                                                                    |
| [@release-it-plugins/workspaces](https://github.com/release-it-plugins/workspaces)              | Release each configured workspace                                                                                                                            |
| [@jcamp-code/release-it-changelogen](https://github.com/jcamp-code/release-it-changelogen)      | Use [@unjs/changelogen](https://github.com/unjs/changelogen) for versioning and changelog                                                                    |
| [@jcamp-code/release-it-dotnet](https://github.com/jcamp-code/release-it-dotnet)                | Use `.csproj` / `.props` files for versioning + NuGet publishing                                                                                             |
| [release-it-calver-plugin](https://github.com/casmith/release-it-calver-plugin)                 | Calendar Versioning                                                                                                                                          |
| [@grupoboticario/news-fragments](https://github.com/grupoboticario/news-fragments)              | Fragment-based changelogs                                                                                                                                    |
| [@j-ulrich/release-it-regex-bumper](https://github.com/j-ulrich/release-it-regex-bumper)        | Regex-based version read/write                                                                                                                               |
| [release-it-pnpm](https://github.com/hyoban/release-it-pnpm)                                    | pnpm workspaces support + [bumpp](https://github.com/antfu/bumpp) / [changelogithub](https://github.com/antfu/changelogithub)                                |
| [changesets-release-it-plugin](https://www.npmjs.com/package/changesets-release-it-plugin)      | Bridge [Changesets](https://github.com/changesets/changesets) with release-it                                                                                |
| [release-it-gitea](https://github.com/lib-pack/release-it-gitea)                                | Gitea releases + attachments                                                                                                                                 |
| [release-it-beautiful-changelog](https://github.com/mohammadGh/release-it-beautiful-changelog)  | Beautiful Conventional-Commits changelogs via [@unjs/changelogen](https://github.com/unjs/changelogen)                                                       |

## Core plugins

release-it ships with five internal plugins that use the same API third-party plugins do — see
[Plugin architecture](/release-it/explanations/plugin-architecture/) for the details and
[`lib/plugin`](https://github.com/release-it/release-it/tree/main/lib/plugin) for the source.
