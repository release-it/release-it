export default {
  files: ['test/*.js'],
  helpers: ['**/util/**', '**/stub/**'],
  require: ['./test/util/setup.js'],
  verbose: true
};
