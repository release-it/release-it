import isCi from 'is-ci';

export default () => ({
  failFast: !isCi,
  require: ['./test/util/setup.js'],
  verbose: true
});
