import test from 'node:test';
import assert from 'node:assert/strict';
import Spinner from '../lib/spinner.js';
import Config from '../lib/config.js';

const getConfig = async options => {
  const testConfig = {
    ci: false,
    config: false
  };
  const config = new Config(Object.assign({}, testConfig, options));
  await config.init();

  return config;
};

test('should not show spinner and not execute task if disabled', async t => {
  const ora = t.mock.fn();
  const task = t.mock.fn();
  const spinner = new Spinner({ container: { ora } });
  await spinner.show({ enabled: false, task });
  assert.equal(task.mock.callCount(), 0);
  assert.equal(ora.mock.callCount(), 0);
});

test('should show spinner and run task by default', async t => {
  const ora = t.mock.fn();
  const task = t.mock.fn(() => Promise.resolve());
  const label = 'foo';
  const config = await getConfig({ ci: true });
  const spinner = new Spinner({ container: { ora, config } });
  await spinner.show({ task, label });
  assert.equal(task.mock.callCount(), 1);
  assert.equal(ora.mock.callCount(), 1);
  assert.equal(ora.mock.calls[0].arguments[0], task.mock.calls[0].result);
  assert.equal(ora.mock.calls[0].arguments[1], label);
});

test('should run task, but not show spinner if interactive', async t => {
  const ora = t.mock.fn();
  const task = t.mock.fn(() => Promise.resolve());
  const config = await getConfig({ ci: false });
  const spinner = new Spinner({ container: { ora, config } });
  await spinner.show({ task });
  assert.equal(task.mock.callCount(), 1);
  assert.equal(ora.mock.callCount(), 0);
});

test('should run task and show spinner if interactive, but external', async t => {
  const ora = t.mock.fn();
  const task = t.mock.fn(() => Promise.resolve());
  const config = await getConfig({ ci: false });
  const spinner = new Spinner({ container: { ora, config } });
  await spinner.show({ task, external: true });
  assert.equal(task.mock.callCount(), 1);
  assert.equal(ora.mock.callCount(), 1);
});
