# Environment Variables

For GitHub or GitLab releases, make sure the token is available as an environment variable. Example:

```bash
export GITHUB_TOKEN="f941e0..."
```

In macOS or Linux, this can be added to e.g. `~/.profile`, so it's available everytime the shell is used.

Another solution, that works in every environment (Windows, macOS, Linux), is to use an `.env` file and a package like
[dotenv-cli](https://github.com/entropitor/dotenv-cli#readme):

In the `.env` file:

```bash
GITHUB_TOKEN="f941e0..."
```

Install the `dotenv-cli` package as a `devDependency`:

```bash
npm install -D dotenv-cli
```

Prefix the release-it script like so:

```json
{
  "scripts": {
    "release": "dotenv release-it"
  }
}
```

- Do not check the token into the Git repository.
- Do not check the `.env` file into the Git repository (add it to `.gitignore`).
- Do not put the actual token in the release-it configuration. It will be read from the `GITHUB_TOKEN` environment
  variable. To use something different, use e.g. `github.tokenRef="RELEASE_IT_GITHUB_TOKEN"` (or `gitlab.tokenRef`).

All of the above is the same for `GITLAB_TOKEN`.
