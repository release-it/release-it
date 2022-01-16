import semver from 'semver';
import chalk from 'chalk';
import Plugin from '../Plugin.js';

const { green, red, redBright } = chalk;

const RELEASE_TYPES = ['patch', 'minor', 'major'];
const PRERELEASE_TYPES = ['prepatch', 'preminor', 'premajor'];
const CONTINUATION_TYPES = ['prerelease', 'pre'];
const ALL_RELEASE_TYPES = [...RELEASE_TYPES, ...PRERELEASE_TYPES, ...CONTINUATION_TYPES];

const CHOICES = {
  latestIsPreRelease: [...RELEASE_TYPES, CONTINUATION_TYPES[0]],
  preRelease: PRERELEASE_TYPES,
  default: [...RELEASE_TYPES, ...PRERELEASE_TYPES]
};

const getIncrementChoices = context => {
  const { latestIsPreRelease, isPreRelease, preReleaseId } = context.version;
  const types = latestIsPreRelease ? CHOICES.latestIsPreRelease : isPreRelease ? CHOICES.preRelease : CHOICES.default;
  const choices = types.map(increment => ({
    name: `${increment} (${semver.inc(context.latestVersion, increment, preReleaseId)})`,
    value: increment
  }));
  const otherChoice = {
    name: 'Other, please specify...',
    value: null
  };
  return [...choices, otherChoice];
};

const versionTransformer = context => input =>
  semver.valid(input) ? (semver.gt(input, context.latestVersion) ? green(input) : red(input)) : redBright(input);

const prompts = {
  incrementList: {
    type: 'list',
    message: () => 'Select increment (next version):',
    choices: context => getIncrementChoices(context),
    pageSize: 9
  },
  version: {
    type: 'input',
    message: () => `Please enter a valid version:`,
    transformer: context => versionTransformer(context),
    validate: input => !!semver.valid(input) || 'The version must follow the semver standard.'
  }
};

class Version extends Plugin {
  constructor(...args) {
    super(...args);
    this.registerPrompts(prompts);
  }

  getIncrement(options) {
    return options.increment;
  }

  getIncrementedVersionCI(options) {
    return this.incrementVersion(options);
  }

  async getIncrementedVersion(options) {
    const { isCI } = this.config;
    const version = this.incrementVersion(options);
    return version || (isCI ? null : await this.promptIncrementVersion(options));
  }

  promptIncrementVersion(options) {
    return new Promise(resolve => {
      this.step({
        prompt: 'incrementList',
        task: increment =>
          increment
            ? resolve(this.incrementVersion(Object.assign({}, options, { increment })))
            : this.step({ prompt: 'version', task: resolve })
      });
    });
  }

  isPreRelease(version) {
    return Boolean(semver.prerelease(version));
  }

  isValid(version) {
    return Boolean(semver.valid(version));
  }

  incrementVersion({ latestVersion, increment, isPreRelease, preReleaseId }) {
    if (increment === false) return latestVersion;

    const latestIsPreRelease = this.isPreRelease(latestVersion);
    const isValidVersion = this.isValid(increment);

    if (latestVersion) {
      this.setContext({ latestIsPreRelease });
    }

    if (isValidVersion && semver.gte(increment, latestVersion)) {
      return increment;
    }

    if (isPreRelease && !increment && latestIsPreRelease) {
      return semver.inc(latestVersion, 'prerelease', preReleaseId);
    }

    if (this.config.isCI && !increment) {
      if (isPreRelease) {
        return semver.inc(latestVersion, 'prepatch', preReleaseId);
      } else {
        return semver.inc(latestVersion, 'patch');
      }
    }

    const normalizedType = RELEASE_TYPES.includes(increment) && isPreRelease ? `pre${increment}` : increment;
    if (ALL_RELEASE_TYPES.includes(normalizedType)) {
      return semver.inc(latestVersion, normalizedType, preReleaseId);
    }

    const coercedVersion = !isValidVersion && semver.coerce(increment);
    if (coercedVersion) {
      this.log.warn(`Coerced invalid semver version "${increment}" into "${coercedVersion}".`);
      return coercedVersion.toString();
    }
  }
}

export default Version;
