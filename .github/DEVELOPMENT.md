# Development Notes

Tooling notes for maintainers working on release-it itself. General contribution
guidance lives in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Local GitLab CE for integration testing

The GitLab plugin talks to a real GitLab instance. For local development against
non-published nightly features, run a full GitLab Community Edition instance in
Docker:

```bash
docker run \
  --hostname localhost \
  --publish 443:443 --publish 80:80 --publish 22:22 \
  --name gitlab \
  --restart always \
  --volume config:/etc/gitlab \
  --volume logs:/var/log/gitlab \
  --volume data:/var/opt/gitlab \
  gitlab/gitlab-ce:nightly
```

After the container boots (this can take several minutes on first run), the
GitLab UI is available at http://localhost — sign in and create a personal
access token to use as `GITLAB_TOKEN`.

### Useful API references

- [Octokit REST (GitHub)](https://octokit.github.io/rest.js/) — the client
  release-it's GitHub plugin uses.
- [GitLab REST API](https://docs.gitlab.com/api/rest/) — top-level index.
- [GitLab Releases API](https://docs.gitlab.com/api/releases/) — the endpoints
  used by `lib/plugin/gitlab`.
- [GitLab Release Links API](https://docs.gitlab.com/api/releases/links/) —
  attach asset links to a release.
- [GitLab Generic Packages API](https://docs.gitlab.com/user/packages/generic_packages/) —
  used when `gitlab.useGenericPackageRepositoryForAssets` is enabled.

## Generating terminal recording assets

The animated demos shipped with the docs (e.g. `release-it-interactive.gif`,
`release-it-prerelease.gif`) are generated from
[asciinema](https://asciinema.org/) recordings converted to SVG with
[`svg-term`](https://github.com/marionebl/svg-term-cli):

```bash
# 1. Record a session — everything you type until you press Ctrl-D is captured.
asciinema rec release-it.cast

# 2. Convert the recording to an SVG. `--padding` adds breathing room around
#    the terminal frame; adjust to taste.
cat release-it.cast | svg-term --out release-it.svg --padding 10
```

Install the tools locally with:

```bash
brew install asciinema         # or `pipx install asciinema`
npm install --global svg-term-cli
```

Drop the resulting SVG into `docs/src/assets/` (or `docs/public/` for files
that must be served as-is) and reference it from the relevant Markdown page.
