# Auto-changelog

Please refer to [auto-changelog documentation](https://github.com/CookPete/auto-changelog) for more details and usage.

## Config

Add auto-changelog to the project:

```bash
npm install --save-dev auto-changelog
```

Example configuration in the release-it config:

```json
{
  "git": {
    "changelog": "npx auto-changelog --stdout --commit-limit false --unreleased --template https://raw.githubusercontent.com/release-it/release-it/master/templates/changelog-compact.hbs"
  },
  "hooks": {
    "after:bump": "npx auto-changelog -p"
  }
}
```

## Template

This is basically a copy of the
[default auto-changelog template](https://github.com/CookPete/auto-changelog/blob/master/templates/compact.hbs).
However, the title is removed, and the `releases` iterator has a `{{#if @first}}` block to only show commits within the
unreleased tag:

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

The template above [changelog-compact.hbs](../../templates/changelog-compact.hbs) can also be used directly from here:

```json
{
  "git": {
    "changelog": "npx auto-changelog --stdout --commit-limit false --unreleased --template https://raw.githubusercontent.com/release-it/release-it/master/templates/changelog-compact.hbs"
  },
  "hooks": {
    "after:bump": "npx auto-changelog -p"
  }
}
```

Projects without a `package.json` that need to generate a `CHANGELOG.md` compatible with
[https://keepachangelog.com](https://keepachangelog.com) can use this example:

```json
{
  "git": {
    "changelog": "npx auto-changelog --stdout --commit-limit false --unreleased --template https://raw.githubusercontent.com/release-it/release-it/master/templates/changelog-compact.hbs"
  },
  "hooks": {
    "after:bump": "npx auto-changelog --commit-limit false --template https://raw.githubusercontent.com/release-it/release-it/master/templates/keepachangelog.hbs"
  }
}
```
