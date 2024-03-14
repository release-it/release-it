export type HookPrefix = 'before' | 'after';
export type InternalPlugin = 'version' | 'git' | 'npm' | 'github' | 'gitlab';
export type HookName = 'init' | 'bump' | 'release';

export type Hooks = {
  ['before:init']?: string | string[];
  ['before:bump']?: string | string[];
  ['before:release']?: string | string[];
  ['after:init']?: string | string[];
  ['after:bump']?: string | string[];
  ['after:release']?: string | string[];

  ['before:version:init']?: string | string[];
  ['before:version:bump']?: string | string[];
  ['before:version:release']?: string | string[];
  ['after:version:init']?: string | string[];
  ['after:version:bump']?: string | string[];
  ['after:version:release']?: string | string[];

  ['before:git:init']?: string | string[];
  ['before:git:bump']?: string | string[];
  ['before:git:release']?: string | string[];
  ['after:git:init']?: string | string[];
  ['after:git:bump']?: string | string[];
  ['after:git:release']?: string | string[];

  ['before:npm:init']?: string | string[];
  ['before:npm:bump']?: string | string[];
  ['before:npm:release']?: string | string[];
  ['after:npm:init']?: string | string[];
  ['after:npm:bump']?: string | string[];
  ['after:npm:release']?: string | string[];

  ['before:github:init']?: string | string[];
  ['before:github:bump']?: string | string[];
  ['before:github:release']?: string | string[];
  ['after:github:init']?: string | string[];
  ['after:github:bump']?: string | string[];
  ['after:github:release']?: string | string[];

  ['before:gitlab:init']?: string | string[];
  ['before:gitlab:bump']?: string | string[];
  ['before:gitlab:release']?: string | string[];
  ['after:gitlab:init']?: string | string[];
  ['after:gitlab:bump']?: string | string[];
  ['after:gitlab:release']?: string | string[];
};
