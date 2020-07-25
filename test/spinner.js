const test = require('ava');
const sinon = require('sinon');
const Spinner = require('../lib/spinner');
const Config = require('../lib/config');

test.beforeEach(t => {
  t.context.ora = {
    promise: sinon.spy()
  };
});

const getConfig = options => {
  const testConfig = {
    ci: false,
    config: false,
    'disable-metrics': true
  };
  return new Config(Object.assign({}, testConfig, options));
};

test('should not show spinner and not execute task if disabled', async t => {
  const { ora } = t.context;
  const task = sinon.spy();
  const spinner = new Spinner({ container: { ora } });
  await spinner.show({ enabled: false, task });
  t.is(task.callCount, 0);
  t.is(ora.promise.callCount, 0);
});

test('should show spinner and run task by default', async t => {
  const { ora } = t.context;
  const task = sinon.stub().resolves();
  const label = 'foo';
  const config = getConfig({ ci: true });
  const spinner = new Spinner({ container: { ora, config } });
  await spinner.show({ task, label });
  t.is(task.callCount, 1);
  t.is(ora.promise.callCount, 1);
  t.is(ora.promise.firstCall.args[0], task.firstCall.returnValue);
  t.is(ora.promise.firstCall.args[1], label);
});

test('should run task, but not show spinner if interactive', async t => {
  const { ora } = t.context;
  const task = sinon.stub().resolves();
  const config = getConfig({ ci: false });
  const spinner = new Spinner({ container: { ora, config } });
  await spinner.show({ task });
  t.is(task.callCount, 1);
  t.is(ora.promise.callCount, 0);
});

test('should run task and show spinner if interactive, but external', async t => {
  const { ora } = t.context;
  const task = sinon.stub().resolves();
  const config = getConfig({ ci: false });
  const spinner = new Spinner({ container: { ora, config } });
  await spinner.show({ task, external: true });
  t.is(task.callCount, 1);
  t.is(ora.promise.callCount, 1);
});
