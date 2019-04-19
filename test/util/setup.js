const test = require('ava');
require('shelljs').config.silent = true;

const { GITHUB_TOKEN, GITLAB_TOKEN } = process.env;

process.env.GITHUB_TOKEN = process.env.GITLAB_TOKEN = 1;

test.after.always(() => {
  process.env.GITHUB_TOKEN = GITHUB_TOKEN;
  process.env.GITLAB_TOKEN = GITLAB_TOKEN;
});
