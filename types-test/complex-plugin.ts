import { Plugin } from '../';
import { IncrementBase } from '../types/plugin';

interface PluginOptions {
  myRequiredString: string;
  myRequiredNumber: number;
  optionalBoolean?: boolean;
  nested: {
    myNestedString: string;
  }
}

interface PluginContext {
  nested: {
    contextProp: string;
  };
}

export class ComplexPlugin extends Plugin<PluginOptions, PluginContext> {
  override init(): void {
    this.log.info(this.options.myRequiredString);
    this.log.info(this.getInitialOptions(this.config.options, this.getName()).myRequiredString);

    this.log.info(this.config.isDryRun);
    this.log.info(this.config.isIncrement);
    this.log.info(this.config.isVerbose);
    this.log.info(this.config.isDebug);
    this.log.info(this.config.isQuiet);
    this.log.info(this.config.isCI);
    this.log.info(this.config.isPromptOnlyVersion);
    this.log.info(this.config.isReleaseVersion);
    this.log.info(this.config.isChangelog);
    this.log.info(this.config.verbosityLevel);

    this.setContext({
      nested: {
        contextProp: 'contextValue'
      },
    });

    this.registerPrompts({
      'bump-prompt': {
        message: () => 'Bump version?',
        type: 'confirm',
        default: true
      },
      'some-prompt': {
        message: (context: Record<string, any>) => 'Choose an increment [' + context?.contextProp + ']:',
        type: 'list',
        choices: () => ['major', 'minor', 'patch'],
        default: 'patch'
      }
    });
  }

  override getName() {
    return 'complex-plugin';
  }

  override async getLatestVersion(): Promise<string> {
    return this.shell.exec('echo "1.2.3"');
  }

  override getChangelog(latestVersion: string): Promise<string> {
    return Promise.resolve(`Dummy Changelog for ${latestVersion}`);
  }

  override async getIncrement(): Promise<string> {
    return this.showPrompt({
      prompt: 'some-prompt',
      context: { contextProp: 'contextValue' }
    });
  }

  override getIncrementedVersion(incrementBase: IncrementBase): string {
    return '1.3.0';
  }

  override getIncrementedVersionCI(incrementBase: IncrementBase): string {
    return '1.3.0';
  }

  override beforeBump(): void {}
  override async bump(version: string): Promise<void> {
    this.log.info('Nested context prop: ' + this.getContext('nested.contextProp'));
    this.step({
      prompt: 'bump-prompt',
      label: 'Bumping version...',
      task: async () => {
        await this.shell.exec(`echo "Bumping version to ${version}"`);
      }
    });
  }

  override beforeRelease(): void {}
  override async release(): Promise<void> {
    await this.spinner.show({
      label: 'Releasing...',
      task: async () => {
        await this.shell.exec('echo "Releasing..."');
      }
    });
  }
  override afterRelease(): void {}
}
