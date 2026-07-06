---
title: Programmatic usage recipe
description: Import release-it as a Node.js dependency and invoke it programmatically from your own scripts.
sidebar:
  label: Programmatic use
  order: 6
---

While release-it is designed as a CLI, it can also be imported and driven from Node.js:

```js
import release from 'release-it';

release(options).then(output => {
  console.log(output);
  // { version, latestVersion, name, changelog }
});
```

The `options` object accepts the same shape as any [configuration
file](/release-it/guides/core-workflow/configuration/), and the resolved output contains the released version,
the previous version, the package name, and the rendered changelog — handy for downstream
tooling.
