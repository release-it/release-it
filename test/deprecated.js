const test = require('ava');
const sinon = require('sinon');
const _ = require('lodash');
const deprecated = require('../lib/deprecated');
const Log = require('../lib/log');

test('should show deprecation warnings and return compliant object', t => {
  const log = sinon.createStubInstance(Log);
  const config = deprecated(
    {
      buildCommand: 'foo',
      safeBump: false,
      src: {
        commit: false,
        commitMessage: 'bar'
      }
    },
    log
  );
  const args = _.flatten(log.warn.args);
  t.is(args[0], 'Deprecated configuration options found. Please migrate before the next major release.');
  t.true(args.includes('The "buildCommand" option is deprecated. Please use "scripts.beforeStage" instead.'));
  t.true(args.includes('The "safeBump" option is deprecated.'));
  t.true(args.includes('The "src.commit" option is deprecated. Please use "git.commit" instead.'));
  t.true(args.includes('The "src.commitMessage" option is deprecated. Please use "git.commitMessage" instead.'));
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
