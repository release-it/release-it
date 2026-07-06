---
title: Execution order
description: When each release-cycle method fires — the order plugins run in, why core plugins run last for early hooks and first for late hooks, and what that means for you.
---

release-it's plugin lifecycle has a strict order. Getting the order right is the difference
between a plugin that "just works" and one that fights the core plugins for control.

## The core rule

Given two custom plugins configured like this:

```json
{
  "plugins": {
    "PluginA": {},
    "PluginB": {}
  }
}
```

The order for each release-cycle method is:

- **`init`**, then **getter methods** (`getName`, `getLatestVersion`), then **`beforeBump`**,
  **`bump`**, and **`beforeRelease`**:

  `PluginA` → `PluginB` → `npm` → `git` → `github` → `gitlab` → `version`.

  Custom plugins run **first**, core plugins **last**.

- **`release`** and **`afterRelease`**:

  The order is **reversed**. Core plugins finish their work first; custom plugins can then run
  deployment hooks or send success notifications _after_ everything is published.

## Why this order?

- Early lifecycle methods gather data. Running custom plugins first lets them override values
  (`name`, `latestVersion`, `repo`, `changelog`) that would otherwise come from the core
  plugins.
- Late lifecycle methods act on that data. Running core plugins first ensures the release is
  actually published before your notification plugin says "🎉 released!" in Slack.

## Getter methods use "first non-empty"

For `getName` and `getLatestVersion`, the **first plugin that returns a value wins**. Only
that value is used for the rest of the release.

**Example.** If the `npm` plugin is enabled, `npm.getName()` typically returns the `name` from
`package.json` — so no other plugin is asked. If `npm` is disabled, the next plugin's
`getName` is invoked — for example, the `git` plugin infers the name from the remote URL.

## Where hooks fit

`before:[step]` and `after:[step]` hooks run around the whole step for all plugins — not per
plugin. `before:[plugin]:[step]` and `after:[plugin]:[step]` run around a single plugin. See
[Hooks](/release-it/guides/core-workflow/hooks/) for the format.

Combined with the ordering rule above, that means:

- `before:release` fires just once, before either PluginA or PluginB's `release` runs.
- `before:git:release` fires just before the `git` plugin's `release`.
- `after:release` fires just once, after every plugin's `release` (and `afterRelease`) is
  done.

## Skipped steps skip their hooks

If `git.push` is `false` or `git push` fails, `after:git:release` **does not fire**. Design
your notifications around this — an `after:release` at the very end is a safe place to
declare success.
