export default {
  workerThreads: false,
  files: ['test/*.js'],
  require: ['./test/util/setup.js'],
  verbose: true,
  environmentVariables: {
    GITHUB_TOKEN: '1',
    GITLAB_TOKEN: '1'
  }
};
