const test = require('ava');
const sinon = require('sinon');
const Metrics = require('../lib/metrics');

test('metrics', async t => {
  const stub = sinon.stub().resolves();
  const metrics = new Metrics({ request: stub });
  await metrics.trackEvent('test');
  t.true(stub.calledWithMatch(/google-analytics.com\/collect/, sinon.match.object));
});

test('metrics (disabled)', async t => {
  const stub = sinon.stub().resolves();
  const metrics = new Metrics({ isEnabled: false, request: stub });
  await metrics.trackEvent('test');
  t.true(stub.notCalled);
});
