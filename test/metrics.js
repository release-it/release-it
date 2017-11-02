import test from 'tape';
import proxyquire from 'proxyquire';
import sinon from 'sinon';

const got = sinon.stub().returns(Promise.resolve({}));

const { default: trackEvent } = proxyquire('../lib/metrics', {
  got
});

test('metrics', async t => {
  await trackEvent('test');
  t.assert(got.calledWithMatch(/google-analytics.com\/collect/, sinon.match.object));
  got.resetHistory();
  t.end();
});
