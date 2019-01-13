const { EOL } = require('os');
const GitHub = require('./github');
const GitLab = require('./gitlab');
const npm = require('./npm');

const prepareDistRepo = async ({ version, options, spinner, shell, gitClient }) => {
  const { scripts, repo, stageDir, files, baseDir, pkgFiles } = options;
  const { beforeStage } = scripts;

  const clone = () => gitClient.clone(repo, stageDir);
  const beforeStageTask = () => shell.runTemplateCommand(beforeStage);

  await spinner.show({ task: clone, label: 'Clone' });
  await shell.copy(files, stageDir, { cwd: baseDir });
  await shell.pushd(stageDir);
  await shell.bump(pkgFiles, version);
  await spinner.show({ enabled: beforeStage, task: beforeStageTask, label: beforeStage, forced: true });
  await gitClient.stageDir();
  await shell.popd();
};

const getDistRepoClients = ({ options, log, isDryRun, changelogs, shell, remoteUrl }) => {
  const { dist, name } = options;

  log.log(`${EOL}🚀 Let's release the distribution repo for ${name}`);

  const ghDistClientOptions = [options.github, dist.github, options.git, dist.git];
  const glDistClientOptions = [options.gitlab, dist.gitlab, options.git, dist.git];
  const ghClient = new GitHub(...ghDistClientOptions, { isDryRun, remoteUrl }, { log, changelogs });
  const glClient = new GitLab(...glDistClientOptions, { isDryRun, remoteUrl }, { log, changelogs });
  const npmClient = new npm(options.npm, dist.npm, { isDryRun }, { shell, log });

  ghClient.validate();
  glClient.validate();

  return {
    ghClient,
    glClient,
    npmClient
  };
};

module.exports = {
  prepareDistRepo,
  getDistRepoClients
};
