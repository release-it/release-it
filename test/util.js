const test = require('tape');
const { format, template, truncateLines } = require('../lib/util');

test('format', t => {
  t.equal(format('release v%s', '1.0.0'), 'release v1.0.0');
  t.equal(format('release v%s (%s)', '1.0.0', 'name'), 'release v1.0.0 (name)');
  t.end();
});

test('template', t => {
  t.equal(template('release v${version}', { version: '1.0.0' }), 'release v1.0.0');
  t.equal(template('release v${version} (${name})', { version: '1.0.0', name: 'foo' }), 'release v1.0.0 (foo)');
  t.end();
});

test('truncateLines', t => {
  const input = '1\n2\n3\n4\n5\n6';
  t.equal(truncateLines(input), input);
  t.equal(truncateLines(input, 3), '1\n2\n3\n...and 3 more');
  t.end();
});
