const sinon = require('sinon');
const response = { body: {} };

module.exports = () => {
  return {
    post: sinon.stub().resolves(response),
    extend() {
      return this;
    }
  };
};
