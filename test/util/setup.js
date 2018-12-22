const test = require('tape');
const { Test } = require('tape');
const sh = require('shelljs');
const mockStdIo = require('mock-stdio');

const isSilent = sh.config.silent;
sh.config.silent = true;
test.onFinish(() => (sh.config.silent = isSilent));
test.onFailure(() => sh.rm('-rf', 'test/resources/tmp', 'test/resources/bare.git'));

const noop = () => {};

Test.prototype.shouldReject = function(promise, expected) {
  return promise.then(
    () => this.throws(noop, expected),
    err => {
      const f = () => {
        throw err;
      };
      this.throws(f, expected);
    }
  );
};

Test.prototype.shouldBailOut = function(promise, expected, expectedStdErr) {
  mockStdIo.start();
  return promise.then(
    () => this.throws(noop, expected),
    err => {
      const { stderr } = mockStdIo.end();
      const f = () => {
        throw err;
      };
      this.throws(f, expected);
      const result = expectedStdErr.test(stderr);
      this.ok(result);
      if (!result) {
        console.error(err); // eslint-disable-line no-console
      }
    }
  );
};
