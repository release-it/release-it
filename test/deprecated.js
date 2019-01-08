const test = require('ava');
const mockStdIo = require('mock-stdio');
const deprecated = require('../lib/deprecated');

test('should show deprecation warnings and return compliant object', t => {
  mockStdIo.start();
  const config = deprecated({
    buildCommand: 'foo',
    safeBump: false,
    src: {
      commit: false,
      commitMessage: 'bar'
    }
  });
  const { stdout } = mockStdIo.end();
  t.true(stdout.includes('Deprecated configuration options found. Please migrate before the next major release'));
  t.true(stdout.includes('The "buildCommand" option is deprecated. Please use "scripts.beforeStage" instead'));
  t.true(stdout.includes('The "safeBump" option is deprecated.'));
  t.true(stdout.includes('The "src.commit" option is deprecated. Please use "git.commit" instead'));
  t.true(stdout.includes('The "src.commitMessage" option is deprecated. Please use "git.commitMessage" instead'));
  t.deepEqual(config, {
    scripts: {
      beforeStage: 'foo'
    },
    git: {
      commit: false,
      commitMessage: 'bar'
    }
  });
});
