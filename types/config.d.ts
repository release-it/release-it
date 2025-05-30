import { Hooks } from './hooks';

export interface Config {
  hooks?: Hooks;

  plugins?: Record<string, Record<string, any>>;

  git?: {
    /** @default "git log --pretty=format:\"* %s (%h)\" ${from}...${to}" */
    changelog?: string;

    /** @default true */
    requireCleanWorkingDir?: boolean;

    /** @default false */
    requireBranch?: false | string;

    /** @default true */
    requireUpstream?: boolean;

    /** @default false */
    requireCommits?: boolean;

    /** @default true */
    requireCommitsFail?: boolean;

    /** @default "" */
    commitsPath?: string;

    /** @default false */
    addUntrackedFiles?: boolean;

    /** @default true */
    commit?: boolean;

    /** @default "Release ${version}" */
    commitMessage?: string;

    commitArgs?: Array<any>;

    /** @default true */
    tag?: boolean;

    /** @default null */
    tagExclude?: any;

    /** @default null */
    tagName?: any;

    /** @default null */
    tagMatch?: any;

    /** @default false */
    getLatestTagFromAllRefs?: boolean;

    /** @default "Release ${version}" */
    tagAnnotation?: string;

    tagArgs?: Array<any>;

    /** @default true */
    push?: boolean;

    /** @default ["--follow-tags"] */
    pushArgs?: Array<string>;

    /** @default "" */
    pushRepo?: string;
  };

  npm?: {
    /** @default true */
    publish?: boolean;

    /** @default "." */
    publishPath?: string;

    publishArgs?: Array<any>;

    /** @default null */
    tag?: any;

    /** @default null */
    otp?: any;

    /** @default false */
    ignoreVersion?: boolean;

    /** @default false */
    allowSameVersion?: boolean;

    versionArgs?: Array<any>;

    /** @default false */
    skipChecks?: boolean;

    /** @default 10 */
    timeout?: number;
  };

  github?: {
    /** @default false */
    release?: boolean;

    /** @default "Release ${version}" */
    releaseName?: string;

    /** @default null */
    releaseNotes?: string | null | (() => string | Promise<string>) | { commit?: string; excludeMatches?: string[] };

    /** @default false */
    autoGenerate?: boolean;

    /** @default false */
    preRelease?: boolean;

    /** @default false */
    draft?: boolean;

    /** @default "GITHUB_TOKEN" */
    tokenRef?: string;

    /** @default null */
    assets?: any;

    /** @default null */
    host?: any;

    /** @default 0 */
    timeout?: number;

    /** @default null */
    proxy?: any;

    /**
     * @default true
     * 'legacy' - Github determines the latest release based on the release creation date and higher semantic version.
     * See https://docs.github.com/en/rest/releases/releases?apiVersion=latest#create-a-release
     */
    makeLatest?: boolean | 'legacy';

    /** @default false */
    discussionCategoryName?: boolean | string;

    /** @default false */
    skipChecks?: boolean;

    /** @default false */
    web?: boolean;

    comments?: {
      /** @default false */
      submit?: boolean;

      /** @default ":rocket?: _This issue has been resolved in v${version}. See [${releaseName}](${releaseUrl}) for release notes._" */
      issue?: string;

      /** @default ":rocket?: _This pull request is included in v${version}. See [${releaseName}](${releaseUrl}) for release notes._" */
      pr?: string;
    };
  };

  gitlab?: {
    /** @default false */
    release?: boolean;

    /** @default "Release ${version}" */
    releaseName?: string;

    /** @default null */
    releaseNotes?: any;

    milestones?: Array<any>;

    /** @default "GITLAB_TOKEN" */
    tokenRef?: string;

    /** @default "Private-Token" */
    tokenHeader?: string;

    /** @default null */
    certificateAuthorityFile?: any;

    /** @default false */
    secure?: boolean;

    /** @default null */
    assets?: any;

    /** @default false */
    useIdsForUrls?: boolean;

    /** @default false */
    useGenericPackageRepositoryForAssets?: boolean;

    /** @default "release-it" */
    genericPackageRepositoryName?: string;

    /** @default null */
    origin?: any;

    /** @default false */
    skipChecks?: boolean;
  };
}
