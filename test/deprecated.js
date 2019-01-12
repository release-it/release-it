const test = require('ava');
const sinon = require('sinon');
const deprecated = require('../lib/deprecated');
const Log = require('../lib/log');

test('should show deprecation warnings and return compliant object', t => {
  const log = sinon.createStubInstance(Log);
  const config = deprecated({ keep: 1 }, log);
  t.is(log.warn.callCount, 0);
  t.deepEqual(config, { keep: 1 });
});
