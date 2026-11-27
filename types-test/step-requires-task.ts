import { Plugin } from 'release-it';

export class StepRequiresTaskPlugin extends Plugin {
  override init(): void {
    super.init();
    this.step({
      prompt: 'foo'
    });
  }
}
