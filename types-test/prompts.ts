import { Plugin } from 'release-it';
import { assertType, Equals } from './utils.js';

type StringPromise = Promise<string>;
type StringOrFalsePromise = Promise<string | false>;
type FalsePromise = Promise<false>;
type UndefinedPromise = Promise<undefined>;
type StringOrStringOrFalsePromise = string | Promise<string | false>;
type FalseOrUndefinedPromise = Promise<false | undefined>;
type StringFalseOrUndefinedPromise = Promise<string | false | undefined>;

class Prompts extends Plugin {
  override async bump() {
    const synchronousPromptShowResult = this.prompt.show({
      prompt: 'synchronous',
      task: (answer: unknown): string => {
        return 'foo';
      }
    });
    assertType<Equals<typeof synchronousPromptShowResult, StringOrFalsePromise>>();

    const asynchronousPromptShowResult = this.prompt.show({
      prompt: 'asynchronous',
      task: async (answer: unknown): Promise<string> => {
        return 'foo';
      }
    });
    assertType<Equals<typeof asynchronousPromptShowResult, StringOrFalsePromise>>();

    const disabledPromptShowResult = this.prompt.show({
      prompt: 'disabled',
      enabled: false,
      task: (answer: unknown): string => {
        return 'foo';
      }
    });
    assertType<Equals<typeof disabledPromptShowResult, FalsePromise>>();

    const synchronousSpinnerShowResult = this.spinner.show({
      label: 'synchronous',
      task: (): string => {
        return 'foo';
      }
    });
    assertType<Equals<typeof synchronousSpinnerShowResult, string>>();

    const asynchronousSpinnerShowResult = this.spinner.show({
      label: 'asynchronous',
      task: async (): Promise<string> => {
        return 'foo';
      }
    });
    assertType<Equals<typeof asynchronousSpinnerShowResult, StringPromise>>();

    const disabledSpinnerShowResult = this.spinner.show({
      label: 'disabled',
      enabled: false,
      task: (): string => {
        return 'foo';
      }
    });
    assertType<Equals<typeof disabledSpinnerShowResult, UndefinedPromise>>();

    const synchronousStepResult = this.step({
      prompt: 'synchronous',
      task: (): string => {
        return 'foo';
      }
    });
    assertType<Equals<typeof synchronousStepResult, StringOrStringOrFalsePromise>>();

    const asynchronousStepResult = this.step({
      prompt: 'asynchronous',
      task: async (): Promise<string> => {
        return 'foo';
      }
    });
    assertType<Equals<typeof asynchronousStepResult, StringOrFalsePromise | StringPromise>>();

    const disabledStepResult = this.step({
      prompt: 'disabled',
      enabled: false,
      task: async (): Promise<string> => {
        return 'foo';
      }
    });
    assertType<Equals<typeof disabledStepResult, FalseOrUndefinedPromise>>();

    const minimalStepParametersResult = this.step({
      task: (): string => {
        return 'foo';
      }
    });
    assertType<Equals<typeof minimalStepParametersResult, StringOrStringOrFalsePromise>>();

    const someBoolean = true as boolean;
    const booleanEnabledStepResult = this.step({
      enabled: someBoolean,
      task: async (): Promise<string> => {
        return 'foo';
      }
    });
    assertType<Equals<typeof booleanEnabledStepResult, StringFalseOrUndefinedPromise>>();
  }
}
