const Git = require('./git');
const Shell = require('./shell');
const { DistRepoStageDirError } = require('./errors');

const commitRefRe = /#.+$/;

class GitDist extends Git {
  validate() {
    const { stageDir } = this.options;
    if (stageDir && !this.shell.isSubDir(stageDir)) {
      throw new DistRepoStageDirError(stageDir);
    }
  }

  clone(remoteUrl, targetDir) {
    const commitRef = remoteUrl.match(commitRefRe);
    const branch = commitRef && commitRef[0] ? `-b ${commitRef[0].replace(/^#/, '')}` : '';
    const sanitizedRemoteUrl = remoteUrl.replace(commitRef, '');
    return this.shell
      .run(`git clone ${sanitizedRemoteUrl} ${branch} --single-branch ${targetDir}`, Shell.writes)
      .then(() => sanitizedRemoteUrl);
  }
}

module.exports = GitDist;
