import test from 'tape';
import proxyquire from 'proxyquire';
import pkg from '../package.json';
import * as logMock from '../mock/log';

const { version, help } = proxyquire('../lib/cli', {
  './log': logMock
});

test('version', t => {
  t.plan(1);
  t.equal(version(), `v${pkg.version}`);
});

test('help', t => {
  t.plan(2);
  t.ok(~help().indexOf('Release It!'));
  t.ok(~help().indexOf(pkg.version));
});
