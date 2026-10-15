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


export type PromptShowOptions<AnswerType,TaskReturnType> = {
  enabled?: boolean;
  prompt: string;
  namespace?: string;
  task?: (answer: AnswerType) => TaskReturnType;
  context?: any;
};
export type EnabledPromptShowOptions<AnswerType, TaskReturnType> = {
  enabled?: true;
} & PromptShowOptions<AnswerType, TaskReturnType>;
export type DisabledPromptShowOptions<AnswerType, TaskReturnType> = {
  enabled: false;
} & PromptShowOptions<AnswerType, TaskReturnType>;

export default class Prompt {
  register(pluginPrompts: Record<string, PromptConfig>, namespace?: string): void;

  show<AnswerType, TaskReturnType>(
    options: EnabledPromptShowOptions<AnswerType, TaskReturnType>
  ): TaskReturnType;
  show<AnswerType, TaskReturnType>(
    options: DisabledPromptShowOptions<AnswerType, TaskReturnType>
  ): Promise<false>;
  show<AnswerType, TaskReturnType>(
    options: PromptShowOptions<AnswerType, TaskReturnType>
  ): Promise<false> | TaskReturnType;
}
