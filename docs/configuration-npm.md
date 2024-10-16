### npm configuration options

| Option | Description |
| --- | --- |
| `npm.publish` | Set to `false` to skip the npm publish step. |
| `npm.publishPath` | Publish only a specific folder (e.g. `dist`). |
| `npm.publishArgs` | In case extra arguments should be provided to npm for the publish operation. |
| `npm.tag` | Use e.g. `npm.tag=beta` to tag the package in the npm repository. |
| `npm.otp` | In case two-factor authentication (2FA) is enabled for the package, release-it will ask for the one-time password (OTP). The OTP can be provided from the command line (`npm.otp=123456`). However, providing the OTP without a prompt basically defeats the purpose of 2FA. |
| `npm.ignoreVersion` | When set to `true`, ignore the `version` from `package.json`. |
| `npm.allowSameVersion` | If set to `true`, prevents throwing error when setting the new version to the same value as the current version. Note it is recommended to use `versionArgs` for this instead. |
| `npm.versionArgs` | In case extra arguments should be provided to npm for the versioning operation. |
| `npm.skipChecks` | If set to `true`, skip checks on whether the npm registry is up, the user is authenticated with npm and is a collaborator for the current package. |
| `npm.timeout` | Timeout duration to wait for a response from the npm registry. |
