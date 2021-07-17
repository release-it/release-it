import test from 'ava';
import sinon from 'sinon';
import deprecated from '../lib/deprecated.js';
import Log from '../lib/log.js';

test('should show deprecation warnings and return compliant object', t => {
  const log = sinon.createStubInstance(Log);
  const config = deprecated({ keep: 1 }, log);
  t.is(log.warn.callCount, 0);
  t.deepEqual(config, { keep: 1 });
});
