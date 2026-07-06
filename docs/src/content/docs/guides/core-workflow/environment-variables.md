---
title: Environment variables
description: Make GITHUB_TOKEN, GITLAB_TOKEN and other secrets available to release-it via the shell, a dotenv file, or a prompt.
---

For automated GitHub or GitLab releases, release-it needs an access token. It picks the token
up from the environment — never from your configuration file.

## Set the variable in your shell

```bash
export GITHUB_TOKEN="f941e0..."
```

On macOS or Linux, add that line to `~/.profile` (or `~/.zshrc`) so it's set for every shell
session.

## Using `dotenv`

For a portable, project-scoped setup (Windows, macOS, Linux), keep the tokens in an `.env` file
and load them with [`dotenv-cli`](https://github.com/entropitor/dotenv-cli#readme):

`.env`:

```bash
GITHUB_TOKEN="f941e0..."
```

Install the CLI as a `devDependency`:

```bash
npm install --save-dev dotenv-cli
```

Prefix the release script:

```json
{
  "scripts": {
    "release": "dotenv release-it --"
  }
}
```

## Read from input

Rarely useful, but you can prompt for the token every time:

```json
{
  "scripts": {
    "release": "read -p 'GITHUB_TOKEN: ' GITHUB_TOKEN && export GITHUB_TOKEN=$GITHUB_TOKEN && release-it"
  }
}
```

## Notes

- **Never** commit tokens to Git.
- Add `.env` to `.gitignore`; convention is to keep a redacted `.env.example` in the repository
  for onboarding.
- **Never** put the raw token in the release-it configuration. release-it reads it from the
  `GITHUB_TOKEN` (or `GITLAB_TOKEN`) environment variable. To use a different variable name,
  set [`github.tokenRef`](/release-it/reference/configuration-options/github/) or
  [`gitlab.tokenRef`](/release-it/reference/configuration-options/gitlab/).

All of the above applies equally to `GITLAB_TOKEN`.
