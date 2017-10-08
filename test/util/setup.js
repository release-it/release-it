import { Test } from 'tape';
import shell from 'shelljs';

shell.config.silent = true;

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
