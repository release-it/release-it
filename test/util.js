const { EOL } = require('os');
const test = require('tape');
const { format, truncateLines } = require('../lib/util');

test('format', t => {
  t.equal(format('release v${version}', { version: '1.0.0' }), 'release v1.0.0');
  t.equal(format('release v${version} (${name})', { version: '1.0.0', name: 'foo' }), 'release v1.0.0 (foo)');
  t.equal(format('release v${version} (${name})', { version: '1.0.0', name: 'foo' }), 'release v1.0.0 (foo)');
  t.end();
});

test('format (backwards compatibility)', t => {
  t.equal(format('release v%s', { version: '1.0.0' }), 'release v1.0.0');
  t.equal(
    format('bar --foo="${foo}" --bar="%s" v%s', { foo: 'bar', version: '1.0.0' }),
    'bar --foo="bar" --bar="1.0.0" v1.0.0'
  );
  t.end();
});

test('truncateLines', t => {
  const input = `1${EOL}2${EOL}3${EOL}4${EOL}5${EOL}6`;
  t.equal(truncateLines(input), input);
  t.equal(truncateLines(input, 3), `1${EOL}2${EOL}3${EOL}...and 3 more`);
  t.equal(truncateLines(input, 1, '...'), `1...`);
  t.end();
});
