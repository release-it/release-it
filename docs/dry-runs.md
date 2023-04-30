# Dry Runs

To show the interactivity and the commands it _would_ execute:

```bash
release-it --dry-run
```

Note that read-only commands are still executed (`$ ...`), while potentially writing/mutating commands are not
(`! ...`):

```bash
$ git rev-parse --git-dir
.git
! git add package.json
! git commit --message="Release 0.8.3"
```

To print the next version without releasing anything, use the `--release-version` flag.

To print the changelog without releasing anything, use the `--changelog` flag.
