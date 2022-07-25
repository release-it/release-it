import test from 'ava';
import { getPluginName } from '../lib/plugin/factory.js';

test('pluginName can return correct name for variants', t => {
  t.is(getPluginName('plain-plugin'), 'plain-plugin');
  t.is(getPluginName('@some/scoped-plugin'), '@some/scoped-plugin');
  t.is(getPluginName('@some/nested/scoped-plugin'), '@some/nested/scoped-plugin');
  t.is(getPluginName('./relative-plugin.cjs'), 'relative-plugin');
});
