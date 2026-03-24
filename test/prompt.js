import test from 'node:test';
import assert from 'node:assert/strict';
import Prompt from '../lib/prompt.js';
import Config from '../lib/config.js';
import git from '../lib/plugin/git/prompts.js';
import github from '../lib/plugin/github/prompts.js';
import gitlab from '../lib/plugin/gitlab/prompts.js';
import npm from '../lib/plugin/npm/prompts.js';
import { factory } from './util/index.js';

const prompts = { git, github, gitlab, npm };

const yes = () => Promise.resolve(true);
const no = () => Promise.resolve(false);

test('should not create prompt if disabled', async t => {
  const task = t.mock.fn();
  const createPrompt = t.mock.fn(yes);
  const prompt = await factory(Prompt, { container: { createPrompt } });
  prompt.register(prompts.git);
  await prompt.show({ enabled: false, prompt: 'push', task });
  assert.equal(createPrompt.mock.callCount(), 0);
  assert.equal(task.mock.callCount(), 0);
});

test('should create prompt', async t => {
  const createPrompt = t.mock.fn(yes);
  const prompt = await factory(Prompt, { container: { createPrompt } });
  prompt.register(prompts.git);
  await prompt.show({ prompt: 'push' });
  assert.equal(createPrompt.mock.callCount(), 1);
  assert.equal(createPrompt.mock.calls[0].arguments[0], 'confirm');
  assert.deepEqual(createPrompt.mock.calls[0].arguments[1], {
    message: 'Push?',
    default: true
  });
});

[
  ['git', 'commit', 'Commit (Release 1.0.0)?'],
  ['git', 'tag', 'Tag (1.0.0)?'],
  ['git', 'push', 'Push?'],
  ['github', 'release', 'Create a pre-release on GitHub (Release 1.0.0)?'],
  ['gitlab', 'release', 'Create a release on GitLab (Release 1.0.0)?'],
  ['npm', 'publish', 'Publish my-pkg@next to npm?'],
  ['npm', 'otp', 'Please enter OTP for npm:']
].map(async ([namespace, prompt, message]) => {
  test(`should create prompt and render template message (${namespace}.${prompt})`, async t => {
    const createPrompt = t.mock.fn(yes);
    const config = new Config({
      isPreRelease: true,
      git: { tagName: 'v${version}' },
      npm: { name: 'my-pkg', tag: 'next' }
    });
    await config.init();
    config.setContext({ version: '1.0.0', tagName: '1.0.0' });
    const p = await factory(Prompt, { container: { createPrompt } });
    p.register(prompts[namespace], namespace);
    await p.show({ namespace, prompt, context: config.getContext() });
    assert.equal(createPrompt.mock.callCount(), 1);
    assert.equal(createPrompt.mock.calls[0].arguments[1].message, message);
  });
});

test('should execute task after positive answer', async t => {
  const task = t.mock.fn();
  const createPrompt = t.mock.fn(yes);
  const prompt = await factory(Prompt, { container: { createPrompt } });
  prompt.register(prompts.git);
  await prompt.show({ prompt: 'push', task });
  assert.equal(createPrompt.mock.callCount(), 1);
  assert.equal(task.mock.callCount(), 1);
  assert.equal(task.mock.calls[0].arguments[0], true);
});

test('should not execute task after negative answer', async t => {
  const task = t.mock.fn();
  const createPrompt = t.mock.fn(no);
  const prompt = await factory(Prompt, { container: { createPrompt } });
  prompt.register(prompts.git);
  await prompt.show({ prompt: 'push', task });
  assert.equal(createPrompt.mock.callCount(), 1);
  assert.equal(task.mock.callCount(), 0);
});
