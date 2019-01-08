const test = require('ava');
const sinon = require('sinon');
const Metrics = require('../lib/metrics');

test('should send metrics', async t => {
  const stub = sinon.stub().resolves();
  const metrics = new Metrics({ request: stub });
  await metrics.trackEvent('test');
  t.true(stub.calledWithMatch(/google-analytics.com\/collect/, sinon.match.object));
});

test('should not send metrics when disabled', async t => {
  const stub = sinon.stub().resolves();
  const metrics = new Metrics({ isEnabled: false, request: stub });
  await metrics.trackEvent('test');
  t.true(stub.notCalled);
});
