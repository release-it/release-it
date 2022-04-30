import path from 'node:path';
import semver from 'semver';
import urlJoin from 'url-join';
import Plugin from '../Plugin.js';
import { hasAccess, rejectAfter, parseVersion, readJSON, e } from '../../util.js';
import prompts from './prompts.js';

const docs = 'https://git.io/release-it-npm';

const options = { write: false };

const MANIFEST_PATH = './package.json';
const DEFAULT_TAG = 'latest';
const DEFAULT_TAG_PRERELEASE = 'next';
const NPM_BASE_URL = 'https://www.npmjs.com';

const fixArgs = args => (args ? (typeof args === 'string' ? args.split(' ') : args) : []);

class npm extends Plugin {
  static isEnabled(options) {
    return hasAccess(MANIFEST_PATH) && options !== false;
  }

  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
  }

  async init() {
    const { name, version: latestVersion, private: isPrivate, publishConfig } = readJSON(path.resolve(MANIFEST_PATH));
    this.setContext({ name, latestVersion, private: isPrivate, publishConfig });

    const { publish, skipChecks } = this.options;

    const timeout = Number(this.options.timeout) * 1000;

    if (publish === false || isPrivate) return;

    if (skipChecks) return;

    const validations = Promise.all([this.isRegistryUp(), this.isAuthenticated(), this.getLatestRegistryVersion()]);

    await Promise.race([validations, rejectAfter(timeout, e(`Timed out after ${timeout}ms.`, docs))]);

    const [isRegistryUp, isAuthenticated, latestVersionInRegistry] = await validations;

    if (!isRegistryUp) {
      throw e(`Unable to reach npm registry (timed out after ${timeout}ms).`, docs);
    }

    if (!isAuthenticated) {
      throw e('Not authenticated with npm. Please `npm login` and try again.', docs);
    }

    if (!(await this.isCollaborator())) {
      const { username } = this.getContext();
      throw e(`User ${username} is not a collaborator for ${name}.`, docs);
    }

    if (!latestVersionInRegistry) {
      this.log.warn('No version found in npm registry. Assuming new package.');
    } else {
      if (!semver.eq(latestVersion, latestVersionInRegistry)) {
        this.log.warn(
          `Latest version in registry (${latestVersionInRegistry}) does not match package.json (${latestVersion}).`
        );
      }
    }
  }

  getName() {
    return this.getContext('name');
  }

  getLatestVersion() {
    return this.options.ignoreVersion ? null : this.getContext('latestVersion');
  }

  async bump(version) {
    const tag = this.options.tag || (await this.resolveTag(version));
    this.setContext({ version, tag });

    if (!this.config.isIncrement) return false;

    const allowSameVersion = this.options.allowSameVersion ? ' --allow-same-version' : '';
    const task = () => this.exec(`npm version ${version} --no-git-tag-version${allowSameVersion}`);
    return this.spinner.show({ task, label: 'npm version' });
  }

  release() {
    if (this.options.publish === false) return false;
    const publish = () => this.publish({ otpCallback });
    const otpCallback = this.config.isCI ? null : task => this.step({ prompt: 'otp', task });
    return this.step({ task: publish, label: 'npm publish', prompt: 'publish' });
  }

  isRegistryUp() {
    const registry = this.getRegistry();
    const registryArg = registry ? ` --registry ${registry}` : '';
    return this.exec(`npm ping${registryArg}`, { options }).then(
      () => true,
      err => {
        if (/code E40[04]|404.*(ping not found|No content for path)/.test(err)) {
          this.log.warn('Ignoring response from unsupported `npm ping` command.');
          return true;
        }
        return false;
      }
    );
  }

  isAuthenticated() {
    const registry = this.getRegistry();
    const registryArg = registry ? ` --registry ${registry}` : '';
    return this.exec(`npm whoami${registryArg}`, { options }).then(
      output => {
        const username = output ? output.trim() : null;
        this.setContext({ username });
        return true;
      },
      err => {
        this.debug(err);
        if (/code E40[04]/.test(err)) {
          this.log.warn('Ignoring response from unsupported `npm whoami` command.');
          return true;
        }
        return false;
      }
    );
  }

  isCollaborator() {
    const registry = this.getRegistry();
    const registryArg = registry ? ` --registry ${registry}` : '';
    const name = this.getName();
    const { username } = this.getContext();
    if (username === undefined) return true;
    if (username === null) return false;
    return this.exec(`npm access ls-collaborators ${name}${registryArg}`, { options }).then(
      output => {
        try {
          const collaborators = JSON.parse(output);
          const permissions = collaborators[username];
          return permissions && permissions.includes('write');
        } catch (err) {
          this.debug(err);
          return false;
        }
      },
      err => {
        this.debug(err);
        if (/code E400/.test(err)) {
          this.log.warn('Ignoring response from unsupported `npm access` command.');
        } else {
          this.log.warn(`Unable to verify if user ${username} is a collaborator for ${name}.`);
        }
        return true;
      }
    );
  }

  async getLatestRegistryVersion() {
    const registry = this.getRegistry();
    const registryArg = registry ? ` --registry ${registry}` : '';
    const name = this.getName();
    const latestVersion = this.getLatestVersion();
    const tag = await this.resolveTag(latestVersion);
    return this.exec(`npm show ${name}@${tag} version${registryArg}`, { options }).catch(() => null);
  }

  getRegistryPreReleaseTags() {
    return this.exec(`npm view ${this.getName()} dist-tags --json`, { options }).then(
      output => {
        try {
          const tags = JSON.parse(output);
          return Object.keys(tags).filter(tag => tag !== DEFAULT_TAG);
        } catch (err) {
          this.debug(err);
          return [];
        }
      },
      () => []
    );
  }

  getPackageUrl() {
    const baseUrl = this.getRegistry() || NPM_BASE_URL;
    return urlJoin(baseUrl, 'package', this.getName());
  }

  getRegistry() {
    const { publishConfig } = this.getContext();
    const registries = publishConfig
      ? publishConfig.registry
        ? [publishConfig.registry]
        : Object.keys(publishConfig)
            .filter(key => key.endsWith('registry'))
            .map(key => publishConfig[key])
      : [];
    return registries[0];
  }

  async guessPreReleaseTag() {
    const [tag] = await this.getRegistryPreReleaseTags();
    if (tag) {
      return tag;
    } else {
      this.log.warn(`Unable to get pre-release tag(s) from npm registry. Using "${DEFAULT_TAG_PRERELEASE}".`);
      return DEFAULT_TAG_PRERELEASE;
    }
  }

  async resolveTag(version) {
    const { tag } = this.options;
    const { isPreRelease, preReleaseId } = parseVersion(version);
    if (!isPreRelease) {
      return DEFAULT_TAG;
    } else {
      return tag || preReleaseId || (await this.guessPreReleaseTag());
    }
  }

  async publish({ otp = this.options.otp, otpCallback } = {}) {
    const { publishPath = '.', publishArgs } = this.options;
    const { private: isPrivate, tag = DEFAULT_TAG } = this.getContext();
    const otpArg = otp ? `--otp ${otp}` : '';
    const dryRunArg = this.config.isDryRun ? '--dry-run' : '';
    if (isPrivate) {
      this.log.warn('Skip publish: package is private.');
      return false;
    }
    const args = [publishPath, `--tag ${tag}`, otpArg, dryRunArg, ...fixArgs(publishArgs)].filter(Boolean);
    return this.exec(`npm publish ${args.join(' ')}`, { options })
      .then(() => {
        this.setContext({ isReleased: true });
      })
      .catch(err => {
        this.debug(err);
        if (/one-time pass/.test(err)) {
          if (otp != null) {
            this.log.warn('The provided OTP is incorrect or has expired.');
          }
          if (otpCallback) {
            return otpCallback(otp => this.publish({ otp, otpCallback }));
          }
        }
        throw err;
      });
  }

  afterRelease() {
    const { isReleased } = this.getContext();
    if (isReleased) {
      this.log.log(`🔗 ${this.getPackageUrl()}`);
    }
  }
}

export default npm;
