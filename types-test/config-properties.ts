import { Plugin } from '../';

function assertIsBoolean(value: boolean): void {}

function assertIsNumber(value: number): void {}

export class ConfigPropertiesCheck extends Plugin {
  override init(): void {
    assertIsBoolean(this.config.isDryRun);
    assertIsBoolean(this.config.isIncrement);
    assertIsBoolean(this.config.isVerbose);
    assertIsBoolean(this.config.isDebug);
    assertIsBoolean(this.config.isQuiet);
    assertIsBoolean(this.config.isCI);
    assertIsBoolean(this.config.isPromptOnlyVersion);
    assertIsBoolean(this.config.isReleaseVersion);
    assertIsBoolean(this.config.isChangelog);
    assertIsNumber(this.config.verbosityLevel);
  }
}
