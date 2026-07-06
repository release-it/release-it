---
title: auto-changelog recipe
description: Configure release-it with auto-changelog to produce a richer Handlebars-based changelog, plus an optional Keep a Changelog compatible template.
sidebar:
  label: auto-changelog
  order: 2
---

Full auto-changelog docs: [github.com/CookPete/auto-changelog](https://github.com/CookPete/auto-changelog).

## Install

```bash
npm install --save-dev auto-changelog
```

## Configure release-it

```json
{
  "git": {
    "changelog": "npx auto-changelog --stdout --commit-limit false --unreleased --template https://raw.githubusercontent.com/release-it/release-it/main/templates/changelog-compact.hbs"
  },
  "hooks": {
    "after:bump": "npx auto-changelog -p"
  }
}
```

## Custom template

A stripped-down version of the [default auto-changelog
template](https://github.com/CookPete/auto-changelog/blob/master/templates/compact.hbs). The
title header is removed, and the outer `releases` loop is fenced by `{{#if @first}}` so only
the unreleased tag renders:

```handlebars
{{#each releases}}
  {{#if @first}}
    {{#each merges}}
      - {{{message}}}{{#if href}} [`#{{id}}`]({{href}}){{/if}}
    {{/each}}
    {{#each fixes}}
      - {{{commit.subject}}}{{#each fixes}}{{#if href}} [`#{{id}}`]({{href}}){{/if}}{{/each}}
    {{/each}}
    {{#each commits}}
      - {{#if breaking}}**Breaking change:** {{/if}}{{{subject}}}{{#if href}} [`{{shorthash}}`]({{href}}){{/if}}
    {{/each}}
  {{/if}}
{{/each}}
```

The template above
([changelog-compact.hbs](https://github.com/release-it/release-it/blob/main/templates/changelog-compact.hbs))
is hosted in release-it's own repo and can be referenced directly:

```json
{
  "git": {
    "changelog": "npx auto-changelog --stdout --commit-limit false --unreleased --template https://raw.githubusercontent.com/release-it/release-it/main/templates/changelog-compact.hbs"
  },
  "hooks": {
    "after:bump": "npx auto-changelog -p"
  }
}
```

## For projects without `package.json`

A [Keep a Changelog](https://keepachangelog.com)–compatible variant:

```json
{
  "git": {
    "changelog": "npx auto-changelog --stdout --commit-limit false --unreleased --template https://raw.githubusercontent.com/release-it/release-it/main/templates/changelog-compact.hbs"
  },
  "hooks": {
    "after:bump": "npx auto-changelog --commit-limit false --template https://raw.githubusercontent.com/release-it/release-it/main/templates/keepachangelog.hbs"
  }
}
```
