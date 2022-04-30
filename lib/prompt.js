import inquirer from 'inquirer';

class Prompt {
  constructor({ container }) {
    this.createPrompt = (container.inquirer || inquirer).prompt;
    this.prompts = {};
  }

  register(pluginPrompts, namespace = 'default') {
    this.prompts[namespace] = this.prompts[namespace] || {};
    Object.assign(this.prompts[namespace], pluginPrompts);
  }

  async show({ enabled = true, prompt: promptName, namespace = 'default', task, context }) {
    if (!enabled) return false;

    const prompt = this.prompts[namespace][promptName];
    const options = Object.assign({}, prompt, {
      name: promptName,
      message: prompt.message(context),
      choices: 'choices' in prompt && prompt.choices(context),
      transformer: 'transformer' in prompt && prompt.transformer(context)
    });

    const answers = await this.createPrompt([options]);

    const doExecute = prompt.type === 'confirm' ? answers[promptName] : true;

    return doExecute && task ? await task(answers[promptName]) : false;
  }
}

export default Prompt;
