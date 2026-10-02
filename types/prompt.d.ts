import { confirm, input, select as list } from '@inquirer/prompts';

export interface MessageProvider {
  message: (context?: any) => string;
}

export interface ChoicesProvider {
  choices: (context?: any) => string[];
}

export type ConfirmPromptConfig = { type: 'confirm' } & MessageProvider &
  Pick<Parameters<typeof confirm>[0], 'default' | 'transformer'>;
export type InputPromptConfig = { type: 'input' } & MessageProvider &
  Pick<Parameters<typeof input>[0], 'default' | 'transformer' | 'validate'>;
export type ListPromptConfig = { type: 'list' } & MessageProvider &
  ChoicesProvider &
  Pick<Parameters<typeof list>[0], 'default' | 'pageSize'>;
export type UnknownPromptConfig = { type: string } & MessageProvider &
  Partial<ChoicesProvider> & {
    default?: any;
    transformer?: (value: any) => any;
    validate?: (value: any) => boolean | string | Promise<boolean | string>;
  };

export type PromptConfig = ConfirmPromptConfig | InputPromptConfig | ListPromptConfig | UnknownPromptConfig;

export type PromptShowOptions<TaskReturnType> = {
  enabled?: boolean;
  prompt: string;
  namespace?: string;
  task?: (answer: string) => TaskReturnType | Promise<TaskReturnType>;
  context?: any;
};

export default class Prompt {
  register(pluginPrompts: Record<string, PromptConfig>, namespace?: string): void;

  show<TaskReturnType>(
    options: PromptShowOptions<TaskReturnType>
  ): TaskReturnType | Promise<TaskReturnType>;
}
