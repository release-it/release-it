const { EOL } = require('os');

class ReleaseItError extends Error {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, this.constructor);
  }
}

class TimeoutError extends ReleaseItError {}

class GitCommitError extends ReleaseItError {}

class GitHubClientError extends ReleaseItError {}

class InvalidVersionError extends ReleaseItError {
  constructor() {
    super('An invalid version was provided.');
  }
}

class InvalidConfigurationError extends ReleaseItError {
  constructor(filePath) {
    super(`Invalid configuration file at ${filePath}`);
  }
}

class GitRemoteUrlError extends ReleaseItError {
  constructor() {
    super('Could not get remote Git url.' + EOL + 'Please add a remote repository.');
  }
}

class GitRequiredBranchError extends ReleaseItError {
  constructor(requiredBranches) {
    super(`Must be on branch ${requiredBranches}`);
  }
}

class GitCleanWorkingDirError extends ReleaseItError {
  constructor() {
    super(
      'Working dir must be clean.' +
        EOL +
        'Please stage and commit your changes.' +
        EOL +
        'Alternatively, use `--no-git.requireCleanWorkingDir` to include the changes in the release commit' +
        ' (or save `"git.requireCleanWorkingDir": false` in the configuration).'
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
        'Alternatively, use `--no-git.requireUpstream` to have this set this by release-it' +
        ' (or save `"git.requireUpstream": false` in the configuration).'
    );
  }
}

class GitNoCommitsError extends ReleaseItError {
  constructor() {
    super('There are no commits since the latest tag.');
  }
}

class GitNetworkError extends ReleaseItError {
  constructor(err, remoteUrl) {
    super(`Unable to fetch from ${remoteUrl}${EOL}${err.message}`);
  }
}

class TokenError extends ReleaseItError {
  constructor(type, tokenRef) {
    super(
      `Environment variable "${tokenRef}" is required for ${type} releases.` +
        EOL +
        `Documentation: https://github.com/release-it/release-it#${type.toLowerCase()}-releases`
    );
  }
}

module.exports = {
  ReleaseItError,
  TimeoutError,
  GitHubClientError,
  InvalidVersionError,
  InvalidConfigurationError,
  GitRemoteUrlError,
  GitRequiredBranchError,
  GitCleanWorkingDirError,
  GitUpstreamError,
  GitNoCommitsError,
  GitCommitError,
  GitNetworkError,
  TokenError
};
