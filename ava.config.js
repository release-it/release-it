import isCi from 'is-ci';

export default () => ({
  files: ['test/*.js'],
  failFast: !isCi,
  require: ['./test/util/setup.js'],
  verbose: true
});
