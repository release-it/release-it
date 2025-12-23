import test from 'node:test';
import assert from 'node:assert/strict';
import { getPluginName } from '../lib/plugin/factory.js';

test('pluginName can return correct name for variants', async () => {
  assert.equal(getPluginName('plain-plugin'), 'plain-plugin');
  assert.equal(getPluginName('@some/scoped-plugin'), '@some/scoped-plugin');
  assert.equal(getPluginName('@some/nested/scoped-plugin'), '@some/nested/scoped-plugin');
  assert.equal(getPluginName('./relative-plugin.cjs'), 'relative-plugin');
});
