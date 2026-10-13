import { Plugin } from "../";

export class PluginStaticMethods extends Plugin {

	static override isEnabled(): Promise<boolean> {
		return Promise.resolve(true);
	}

	static override disablePlugin(): string[] {
		return ['plugin1', 'plugin2'];
	}
}