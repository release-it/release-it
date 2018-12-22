const test = require('tape');
const sinon = require('sinon');
const Metrics = require('../lib/metrics');

test('metrics', async t => {
  const stub = sinon.stub().resolves();
  const metrics = new Metrics({ request: stub });
  await metrics.trackEvent('test');
  t.assert(stub.calledWithMatch(/google-analytics.com\/collect/, sinon.match.object));
  t.end();
});

test('metrics (disabled)', async t => {
  const stub = sinon.stub().resolves();
  const metrics = new Metrics({ isEnabled: false, request: stub });
  await metrics.trackEvent('test');
  t.assert(stub.notCalled);
  t.end();
});
