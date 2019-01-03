const test = require('tape');
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
  t.ok(stdout.includes('Deprecated configuration options found. Please migrate before the next major release'));
  t.ok(stdout.includes('The "buildCommand" option is deprecated. Please use "scripts.beforeStage" instead'));
  t.ok(stdout.includes('The "safeBump" option is deprecated.'));
  t.ok(stdout.includes('The "src.commit" option is deprecated. Please use "git.commit" instead'));
  t.ok(stdout.includes('The "src.commitMessage" option is deprecated. Please use "git.commitMessage" instead'));
  t.deepEqual(config, {
    scripts: {
      beforeStage: 'foo'
    },
    git: {
      commit: false,
      commitMessage: 'bar'
    }
  });
  t.end();
});
