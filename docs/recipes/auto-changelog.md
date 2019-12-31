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
  "hooks": {
    "before:release": "npx auto-changelog -p"
  },
  "git": {
    "changelog": "npx auto-changelog --stdout --commit-limit false --unreleased --template ./preview.hbs"
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

You can also use the template above [changelog-compact-template.hbs](./changelog-compact-template.hbs)
directly from the URL:

```json
{
  "hooks": {
    "before:release": "npx auto-changelog -p"
  },
  "git": {
    "changelog": "npx auto-changelog --stdout --commit-limit false --unreleased --template https://raw.githubusercontent.com/release-it/release-it/master/docs/recipes/changelog-compact-template.hbs"
  }
}
```
