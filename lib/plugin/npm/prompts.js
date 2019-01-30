module.exports = {
  publish: {
    type: 'confirm',
    message: context =>
      `Publish ${context.npm.name}${context.npm.tag === 'latest' ? '' : `@${context.npm.tag}`} to npm?`,
    default: true
  },
  otp: {
    type: 'input',
    message: () => `Please enter OTP for npm:`
  }
};
