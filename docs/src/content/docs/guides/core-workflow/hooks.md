---
title: Hooks
description: Run shell commands at any point in the release lifecycle with before / after hooks — per plugin, with template variables.
---

release-it exposes lifecycle hooks so you can run test commands, builds, notifications, or any
other shell command at exactly the right moment.

See [Hook names](/release-it/reference/hook-names/) for the full naming grammar and internal
hook list, and [Template variables](/release-it/reference/template-variables/) for values you
can interpolate into commands.

## Example

```json
{
  "hooks": {
    "before:init": ["npm run lint", "npm test"],
    "after:my-plugin:bump": "./bin/my-script.sh",
    "after:bump": "npm run build",
    "after:git:release": "echo After git push, before github release",
    "after:release": "echo Successfully released ${name} v${version} to ${repo.repository}."
  }
}
```

A single hook can be a string _or_ an array of strings; array entries run one after another.

> [!CAUTION]
> `after:git:release` (and its siblings) will **not** run when the underlying `git push` failed,
> or when the step was explicitly disabled (e.g. `git.push: false`). See
> [Execution order](/release-it/explanations/execution-order/) for the details.

## Setting hooks from the command line

Quote the whole `--` argument so the shell doesn't try to expand the template first:

```bash
release-it --'hooks.after:release="echo Successfully released ${name} v${version} to ${repo.repository}."'
```

## Debugging hooks

- Add `--verbose` (or `-V`) to print the output of every user-defined hook.
- Add `-VV` to also print the output of every internal command.
- Use `NODE_DEBUG=release-it:* release-it …` for configuration and error details.

## Caveats

Using `@inquirer/prompts` inside a custom hook script can conflict with release-it's own
prompts. If your hook needs interactive input, prefer environment variables or CLI flags
instead.
