import Plugin from '../../lib/plugin/Plugin.js';

class ContextPlugin extends Plugin {
  init() {
    const context = this.config.getContext();
    this.exec(`echo ${context.version.isPreRelease}`);
    this.exec('echo ${version.isPreRelease}');
  }
  beforeBump() {
    const context = this.config.getContext();
    this.exec(`echo ${context.name} ${context.repo.owner} ${context.latestVersion} ${context.version}`);
    this.exec('echo ${name} ${repo.owner} ${latestVersion} ${version}');
  }
  bump(version) {
    const repo = this.config.getContext('repo');
    this.exec(`echo ${repo.owner} ${repo.project} ${repo.repository} ${version}`);
    this.exec('echo ${repo.owner} ${repo.project} ${repo.repository} ${version}');
  }
  beforeRelease() {
    const { repo, tagName } = this.config.getContext();
    this.exec(`echo ${repo.owner} ${repo.project} ${repo.repository} ${tagName}`);
    this.exec('echo ${repo.owner} ${repo.project} ${repo.repository} ${tagName}');
  }
  release() {
    const { repo, latestVersion, version, tagName } = this.config.getContext();
    this.exec(`echo ${repo.project} ${latestVersion} ${version} ${tagName}`);
    this.exec('echo ${repo.project} ${latestVersion} ${version} ${tagName}');
  }
  afterRelease() {
    const { repo, latestVersion, version, tagName } = this.config.getContext();
    this.exec(`echo ${repo.project} ${latestVersion} ${version} ${tagName}`);
    this.exec('echo ${repo.project} ${latestVersion} ${version} ${tagName}');
  }
}

export default ContextPlugin;
