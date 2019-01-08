const { EOL } = require('os');
const test = require('ava');
const { format, truncateLines } = require('../lib/util');

test('format', t => {
  t.is(format('release v${version}', { version: '1.0.0' }), 'release v1.0.0');
  t.is(format('release v${version} (${name})', { version: '1.0.0', name: 'foo' }), 'release v1.0.0 (foo)');
  t.is(format('release v${version} (${name})', { version: '1.0.0', name: 'foo' }), 'release v1.0.0 (foo)');
});

test('format (backwards compatibility)', t => {
  t.is(format('release v%s', { version: '1.0.0' }), 'release v1.0.0');
  t.is(
    format('bar --foo="${foo}" --bar="%s" v%s', { foo: 'bar', version: '1.0.0' }),
    'bar --foo="bar" --bar="1.0.0" v1.0.0'
  );
});

test('truncateLines', t => {
  const input = `1${EOL}2${EOL}3${EOL}4${EOL}5${EOL}6`;
  t.is(truncateLines(input), input);
  t.is(truncateLines(input, 3), `1${EOL}2${EOL}3${EOL}...and 3 more`);
  t.is(truncateLines(input, 1, '...'), `1...`);
});
