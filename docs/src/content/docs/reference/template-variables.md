---
title: Template variables
description: All template variables release-it interpolates into hook commands, this.exec() calls, and configuration strings.
---

release-it interpolates a set of runtime variables into every hook command,
[`this.exec()`](/release-it/reference/plugin-api/#thisexec) call, and configuration string that
uses `${var}` syntax. The full list is below.

## Available variables

All release-it configuration options are available under their namespaces — for example
`${git.tagName}` or `${github.releaseName}`. In addition, these release-time variables are
computed and injected:

| Variable            | Description                                                                       |
| :------------------ | :-------------------------------------------------------------------------------- |
| `version`           | The next version (the one being released).                                        |
| `latestVersion`     | The previous version, before the bump.                                            |
| `latestTag`         | The most recent Git tag (typically `v${latestVersion}`).                          |
| `changelog`         | The generated changelog for this release.                                         |
| `name`              | The project name (from `package.json` or, if npm is disabled, the git remote).    |
| `branchName`        | The current Git branch name.                                                      |
| `releaseUrl`        | URL of the created GitHub / GitLab release. Available after the release step.     |
| `repo.remote`       | The full remote URL.                                                              |
| `repo.protocol`     | `https` or `ssh` (or the equivalent).                                             |
| `repo.host`         | Host portion of the remote — e.g. `github.com`, `gitlab.com`, or a custom domain. |
| `repo.owner`        | Owner segment of the remote — user or organization.                               |
| `repo.repository`   | Full `owner/name` path of the repository.                                         |
| `repo.project`      | Project name (last path segment).                                                 |

## When they're available

- **Hooks** (see [Hook names](/release-it/reference/hook-names/)) — every hook _except_
  `before:init` / `after:init`, where release-specific values haven't been computed yet.
- **`this.exec()`** — every release-cycle method except `init`.
- **Configuration strings** — anywhere a string option accepts a template, e.g.
  `git.commitMessage`, `git.tagAnnotation`, `github.releaseName`, `github.comments.issue`.

## Example

```json
{
  "hooks": {
    "after:release": "echo Successfully released ${name} v${version} to ${repo.repository}."
  }
}
```

See [Hooks](/release-it/guides/core-workflow/hooks/) for the how-to and
[Plugin API — `this.exec()`](/release-it/reference/plugin-api/#thisexec) for programmatic use.
