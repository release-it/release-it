import { makeSynchronized } from 'make-synchronized';
import { loadConfig as loadC12 } from 'c12';

export default makeSynchronized(import.meta, async function loadConfig({ file, dir, extend }) {
  const result = await loadC12({
    name: 'release-it',
    configFile: file ?? '.release-it',
    packageJson: true,
    rcFile: false,
    envName: false,
    cwd: dir,
    defaultConfig: {
      extends: extend
    }
  }).catch(() => {
    throw new Error(`Invalid configuration file at ${file}`);
  });

  if (Object.keys(result.config).length === 0) {
    throw new Error(`no such file ${result.configFile}`);
  }

  return result;
});
