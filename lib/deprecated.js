const util = require('./util');

const deprecatedOptions = {
  src: {
    commitMessage: 'commitMessage',
    tagName: 'tagName',
    tagAnnotation: 'tagAnnotation'
  },
  dist: {
    repo: 'distRepo',
    stageDir: 'distStageDir',
    baseDir: 'distBase',
    files: 'distFiles',
    pkgFiles: 'distPkgFiles'
  },
  npm: {
    publish: 'publish',
    publishPath: 'publishPath',
    private: 'private',
    forcePublishSourceRepo: 'forcePublishSourceRepo'
  },
  github: {
    release: 'githubRelease',
    releaseName: 'githubReleaseName',
    tokenRef: 'githubTokenRef'
  },
  changelogCommand: 'githubReleaseBodyCommand'
};

function fixAndWarn(options, deprecatedOption, cat, opt) {
  const log = require('./log'); // TODO: Fix circular ref
  if(deprecatedOption in options) {
    log.warn(util.format(`Deprecation notice: the option %s will be removed soon. Please use %s${opt ? '.' + opt : ''} instead.`, deprecatedOption, cat));
    if(opt) {
      options[cat][opt] = options[deprecatedOption];
    } else {
      options[cat] = options[deprecatedOption];
    }
    delete options[deprecatedOption];
  }
}

module.exports = function fixDeprecatedOptions(options) {
  for(const cat in deprecatedOptions) {
    if(typeof deprecatedOptions[cat] === 'object') {
      for(const opt in deprecatedOptions[cat]) {
        fixAndWarn(options, deprecatedOptions[cat][opt], cat, opt);
      }
    } else {
      fixAndWarn(options, deprecatedOptions[cat], cat);
    }
  }
  return options;
};
