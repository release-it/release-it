import { Plugin } from '../';

class PluginWithAsyncDisabledSteps extends Plugin {

	override async getName() { return undefined; }
	override async getLatestVersion() { return undefined; }
	override async getChangelog() { return undefined; }
	override async getIncrement() { return undefined; }
	override async getIncrementedVersionCI() { return undefined; }
	override async getIncrementedVersion() { return undefined; }

	override async init() { return false; }
	override async beforeBump() { return false; }
	override async bump(version: string) { return false; }
	override async beforeRelease() { return false; }
	override async release() { return false; }
	override async afterRelease() { return false; }

}