import { Plugin } from '../';

class Prompts extends Plugin {

	override async bump() {
		let expectStringPromise: Promise<string>;
		let expectFalsePromise: Promise<false>;

		expectStringPromise = this.prompt.show({
			prompt: 'synchronous',
			task: (answer: unknown): string => {
				 return 'foo';
			},
		});

		expectStringPromise = this.prompt.show({
			prompt: 'asynchronous',
			task: async (answer: unknown): Promise<string> => {
				return 'foo';
			},
		});

		expectFalsePromise = this.prompt.show({
			prompt: 'disabled',
			enabled: false,
			task: (answer: unknown): string => {
				return 'foo';
			},
		});

		let expectString: string;
		let expectUndefinedPromise: Promise<undefined>;

		expectString = this.spinner.show({
			label: 'synchronous',
			task: (): string => {
				return 'foo';
			},
		});

		expectStringPromise = this.spinner.show({
			label: 'asynchronous',
			task: async (): Promise<string> => {
				return 'foo';
			},
		});

		expectUndefinedPromise = this.spinner.show({
			label: 'disabled',
			enabled: false,
			task: (): string => {
				return 'foo';
			},
		});

		let stringOrStringPromise: string | Promise<string>;

		stringOrStringPromise = this.step({
			prompt: 'synchronous',
			task: (): string => {
				return 'foo';
			},
		});

		expectStringPromise = this.step({
			prompt: 'asynchronous',
			task: async (): Promise<string> => {
				return 'foo';
			},
		});

		let falseOrUndefinedPromise: Promise<false | undefined>;

		falseOrUndefinedPromise = this.step({
			prompt: 'disabled',
			enabled: false,
			task: async (): Promise<string> => {
				return 'foo';
			},
		});
	}

}