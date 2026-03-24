import { confirm, input, select } from '@inquirer/prompts';

const types = { confirm, input, list: select };

class Prompt {
  constructor({ container }) {
    this.createPrompt = container.createPrompt;
    this.prompts = {};
  }

  register(pluginPrompts, namespace = 'default') {
    this.prompts[namespace] = this.prompts[namespace] || {};
    Object.assign(this.prompts[namespace], pluginPrompts);
  }

  async show({ enabled = true, prompt: promptName, namespace = 'default', task, context }) {
    if (!enabled) return false;

    const prompt = this.prompts[namespace][promptName];
    const options = {
      message: prompt.message(context)
    };

    if ('default' in prompt) options.default = prompt.default;
    if ('choices' in prompt) options.choices = prompt.choices(context);
    if ('transformer' in prompt) options.transformer = prompt.transformer(context);
    if ('validate' in prompt) options.validate = prompt.validate;
    if ('pageSize' in prompt) options.pageSize = prompt.pageSize;

    const answer = await (this.createPrompt
      ? this.createPrompt(prompt.type, options)
      : types[prompt.type](options));

    const doExecute = prompt.type === 'confirm' ? answer : true;

    return doExecute && task ? await task(answer) : false;
  }
}

export default Prompt;
