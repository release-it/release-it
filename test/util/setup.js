const shelljs = require('shelljs');
const nock = require('nock');
const test = require('ava');

shelljs.config.silent = true;
nock.disableNetConnect();

const { GITHUB_TOKEN, GITLAB_TOKEN, GITHUB_ACTIONS, GITHUB_ACTOR } = process.env;

process.env.GITHUB_TOKEN = process.env.GITLAB_TOKEN = 1;

test.after.always(() => {
  process.env.GITHUB_TOKEN = GITHUB_TOKEN;
  process.env.GITLAB_TOKEN = GITLAB_TOKEN;
  process.env.GITHUB_ACTIONS = GITHUB_ACTIONS;
  process.env.GITHUB_ACTOR = GITHUB_ACTOR;
});
