const test = require('ava');
const sinon = require('sinon');
const Prompt = require('../lib/prompt');
const Config = require('../lib/config');

const yes = ([options]) => Promise.resolve({ [options.name]: true });
const no = ([options]) => Promise.resolve({ [options.name]: false });
const increment = ([options]) => Promise.resolve({ [options.name]: 'minor' });
const version = ([options]) => Promise.resolve({ [options.name]: '1.3.0' });

test.beforeEach(t => {
  t.context.getInquirer = stub => ({
    prompt: stub
  });
});

test('should not create prompt if disabled', async t => {
  const task = sinon.spy();
  const stub = sinon.stub().callsFake(yes);
  const inquirer = t.context.getInquirer(stub);
  const prompt = new Prompt({ inquirer });
  await prompt.show({ enabled: false, prompt: 'push', task });
  t.is(stub.callCount, 0);
  t.is(task.callCount, 0);
});

test('should create prompt', async t => {
  const stub = sinon.stub().callsFake(yes);
  const inquirer = t.context.getInquirer(stub);
  const prompt = new Prompt({ inquirer });
  await prompt.show({ prompt: 'push' });
  t.is(stub.callCount, 1);
  t.deepEqual(stub.firstCall.args[0][0], {
    type: 'confirm',
    message: 'Push?',
    name: 'push',
    choices: false,
    transformer: false,
    default: true
  });
});

const prompts = [
  ['commit', 'Commit (Release 1.0.0)?'],
  ['tag', 'Tag (v1.0.0)?'],
  ['push', 'Push?'],
  ['ghRelease', 'Create a release on GitHub (Release 1.0.0)?'],
  ['glRelease', 'Create a release on GitLab (Release 1.0.0)?'],
  ['publish', 'Publish release-it@next to npm?'],
  ['otp', 'Please enter OTP for npm:']
];

prompts.map(async ([prompt, message]) => {
  test(`should create prompt and render template message (${prompt})`, async t => {
    const config = new Config({ git: { tagName: 'v${version}' }, npm: { tag: 'next' } });
    config.setRuntimeOptions({
      version: '1.0.0'
    });
    const stub = sinon.stub().callsFake(yes);
    const inquirer = t.context.getInquirer(stub);
    const p = new Prompt({ config, inquirer });
    await p.show({ prompt });
    t.is(stub.callCount, 1);
    t.is(stub.firstCall.args[0][0].message, message);
  });
});

test('should execute task after positive answer', async t => {
  const task = sinon.spy();
  const stub = sinon.stub().callsFake(yes);
  const inquirer = t.context.getInquirer(stub);
  const prompt = new Prompt({ inquirer });
  await prompt.show({ prompt: 'push', task });
  t.is(stub.callCount, 1);
  t.is(task.callCount, 1);
  t.is(task.firstCall.args[0], true);
});

test('should not execute task after negative answer', async t => {
  const task = sinon.spy();
  const stub = sinon.stub().callsFake(no);
  const inquirer = t.context.getInquirer(stub);
  const prompt = new Prompt({ inquirer });
  await prompt.show({ prompt: 'push', task });
  t.is(stub.callCount, 1);
  t.is(task.callCount, 0);
});

test('should create prompt with increment list', async t => {
  const config = new Config();
  config.setRuntimeOptions({
    latestVersion: '1.2.3'
  });
  const task = sinon.spy();
  const stub = sinon.stub().callsFake(increment);
  const inquirer = t.context.getInquirer(stub);
  const prompt = new Prompt({ config, inquirer });
  await prompt.show({ prompt: 'incrementList', task });
  t.is(stub.callCount, 1);
  t.deepEqual(stub.firstCall.args[0][0], {
    type: 'list',
    message: 'Select increment (next version):',
    name: 'incrementList',
    choices: [
      {
        name: 'patch (1.2.4)',
        value: 'patch'
      },
      {
        name: 'minor (1.3.0)',
        value: 'minor'
      },
      {
        name: 'major (2.0.0)',
        value: 'major'
      },
      {
        name: 'prepatch (1.2.4-0)',
        value: 'prepatch'
      },
      {
        name: 'preminor (1.3.0-0)',
        value: 'preminor'
      },
      {
        name: 'premajor (2.0.0-0)',
        value: 'premajor'
      },
      {
        name: 'Other, please specify...',
        value: null
      }
    ],
    pageSize: 9,
    transformer: false,
    default: true
  });
  t.is(task.callCount, 1);
  t.is(task.firstCall.args[0], 'minor');
});

test('should create version input prompt', async t => {
  const config = new Config();
  config.setRuntimeOptions({
    latestVersion: '1.2.3'
  });
  const task = sinon.spy();
  const stub = sinon.stub().callsFake(version);
  const inquirer = t.context.getInquirer(stub);
  const prompt = new Prompt({ config, inquirer });
  await prompt.show({ prompt: 'version', task });
  t.is(stub.callCount, 1);
  t.is(stub.firstCall.args[0][0].type, 'input');
  t.is(stub.firstCall.args[0][0].name, 'version');
  t.is(stub.firstCall.args[0][0].type, 'input');
  t.is(task.callCount, 1);
  t.is(task.firstCall.args[0], '1.3.0');
});
