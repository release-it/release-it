const { EOL } = require('os');

class ReleaseItError extends Error {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, this.constructor);
  }
}

class GitCloneError extends ReleaseItError {}

class GitCommitError extends ReleaseItError {}

class GithubClientError extends ReleaseItError {}

class VersionNotFoundError extends ReleaseItError {
  constructor() {
    super(
      'Unable to find an existing Git tag, or package.json#version. And no or an invalid version is provided.' +
        EOL +
        'Example: release-it 1.0.0'
    );
  }
}

class CancelError extends ReleaseItError {
  constructor(hasChanges) {
    super(`Cancelled (${hasChanges ? 'no changes were made' : 'you may have changes'}).`);
  }
}

class FileNotFoundError extends ReleaseItError {
  constructor(filePath) {
    super(`File not found (${filePath})`);
  }
}

class CreateChangelogError extends ReleaseItError {
  constructor(command) {
    super(`Could not create changelog (${command})`);
  }
}

class GitRepoError extends ReleaseItError {
  constructor() {
    super('Not a git repository.');
  }
}

class GitRemoteUrlError extends ReleaseItError {
  constructor() {
    super('Could not get remote Git url.' + EOL + 'Please add a remote repository.');
  }
}

class GitCleanWorkingDirError extends ReleaseItError {
  constructor() {
    super(
      'Working dir must be clean.' +
        EOL +
        'Please stage and commit your changes.' +
        EOL +
        'Alternatively, use `--no-requireCleanWorkingDir` to include the changes in the release commit' +
        ' (or save `"requireCleanWorkingDir": false` in the configuration).'
    );
  }
}

class GitUpstreamError extends ReleaseItError {
  constructor() {
    super(
      'No upstream configured for current branch.' +
        EOL +
        'Please set an upstream branch.' +
        EOL +
        'Alternatively, use `--no-requireUpstream` to have this set this by release-it' +
        ' (or save `"requireUpstream": false` in the configuration).'
    );
  }
}

class GithubTokenError extends ReleaseItError {
  constructor(tokenRef) {
    super(`Environment variable "${tokenRef}" is required for GitHub releases.`);
  }
}

module.exports = {
  GitCloneError,
  GithubClientError,
  VersionNotFoundError,
  CancelError,
  FileNotFoundError,
  CreateChangelogError,
  GitRepoError,
  GitRemoteUrlError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GitCommitError,
  GithubTokenError
};
