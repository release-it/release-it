const test = require('tape');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const got = sinon.stub().returns(Promise.resolve({}));

const { trackEvent } = proxyquire('../lib/metrics', {
  got
});

test('metrics', async t => {
  await trackEvent('test');
  t.assert(got.calledWithMatch(/google-analytics.com\/collect/, sinon.match.object));
  got.resetHistory();
  t.end();
});
