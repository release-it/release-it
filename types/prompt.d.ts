import { confirm, input, select as list } from '@inquirer/prompts';

export interface MessageProvider {
  message: (context: any) => string;
}

export type ConfirmPromptConfig = { type: 'confirm' } & MessageProvider &
  Pick<Parameters<typeof confirm>[0], 'default' | 'transformer'>;
export type InputPromptConfig = { type: 'input' } & MessageProvider &
  Pick<Parameters<typeof input>[0], 'default' | 'transformer' | 'validate'>;
export type ListPromptConfig = { type: 'list' } & MessageProvider &
  Pick<Parameters<typeof list>[0], 'default' | 'choices' | 'pageSize'>;
export type UnknownPromptConfig = { type: string } & MessageProvider & {
    default?: any;
    choices?: any[];
    transformer?: (value: any) => any;
    validate?: (value: any) => boolean | string | Promise<boolean | string>;
  };

export type PromptConfig = ConfirmPromptConfig | InputPromptConfig | ListPromptConfig | UnknownPromptConfig;

export default interface Prompt {
  register(pluginPrompts: PromptConfig[], namespace?: string): void;

  show<TaskReturnType = any>({
    enabled,
    prompt,
    namespace,
    task,
    context
  }: {
    enabled?: boolean;
    prompt: string;
    namespace?: string;
    task?: (answer: string) => Promise<TaskReturnType>;
    context?: any;
  }): Promise<TaskReturnType>;
}
