import test from 'tape';
import proxyquire from 'proxyquire';
import pkg from '../package.json';
import * as logMock from './mock/log';

const { version, help } = proxyquire('../lib/cli', {
  './log': logMock
});

test('version', t => {
  t.equal(version(), `v${pkg.version}`);
  t.end();
});

test('help', t => {
  t.ok(~help().indexOf('Release It!'));
  t.ok(~help().indexOf(pkg.version));
  t.end();
});
