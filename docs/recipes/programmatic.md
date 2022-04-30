# Use release-it programmatically

From Node.js scripts, release-it can also be used as a dependency:

```js
import release from 'release-it';

release(options).then(output => {
  console.log(output);
  // { version, latestVersion, name, changelog }
});
```
