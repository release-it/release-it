class ReleaseItError extends Error {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class GitCloneError extends ReleaseItError {}

export class ShellExecutionError extends ReleaseItError {}

export class GithubClientError extends ReleaseItError {}

export class VersionNotFoundError extends ReleaseItError {
  constructor() {
    super(
      'Unable to find an existing Git tag, or package.json#version. And no or an invalid version is provided.\n' +
        'Example: release-it 1.0.0'
    );
  }
}

export class CancelError extends ReleaseItError {
  constructor(hasChanges) {
    super(`Cancelled (${hasChanges ? 'no changes were made' : 'you may have changes'}).`);
  }
}

export class FileNotFoundError extends ReleaseItError {
  constructor(filePath) {
    super(`File not found (${filePath})`);
  }
}

export class CreateChangelogError extends ReleaseItError {
  constructor(command) {
    super(`Could not create changelog (${command})`);
  }
}

export class GitRepoError extends ReleaseItError {
  constructor() {
    super('Not a git repository.');
  }
}

export class GitRemoteUrlError extends ReleaseItError {
  constructor() {
    super('Could not get remote Git url.\n' + 'Please add a remote repository.');
  }
}

export class GitCleanWorkingDirError extends ReleaseItError {
  constructor() {
    super(
      'Working dir must be clean.\n' +
        'Please either stage and commit your changes, ' +
        'or use the `requireCleanWorkingDir: false` option to include the changes in the release commit.'
    );
  }
}

export class GitUpstreamError extends ReleaseItError {
  constructor() {
    super(
      'No upstream configured for current branch.\n' +
        'Please either set an upstream branch, ' +
        'or use the `requireUpstream: false` option to have this set this by release-it.'
    );
  }
}

export class GithubTokenError extends ReleaseItError {
  constructor(tokenRef) {
    super(`Environment variable "${tokenRef}" is required for GitHub releases.`);
  }
}
