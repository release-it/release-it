import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';

const typeTestDir = path.dirname(fileURLToPath(import.meta.url));

function getTSConfig() {
  return JSON5.parse(fs.readFileSync(path.join(typeTestDir, 'tsconfig.json'), { encoding: 'utf8' }));
}

const tsConfig = getTSConfig();

function execTypeTest(fileName) {
  const cliParams = tsConfigToCliParams(tsConfig);
  try {
    childProcess.execSync(`npx tsc --ignoreConfig --pretty false ${cliParams.join(' ')} ${fileName}`, {
      cwd: typeTestDir,
      encoding: 'utf8',
      windowsHide: true
    });
  } catch (error) {
    const typeScriptError = new Error(`Compilation of ${path.join(typeTestDir, fileName)} failed:\n${error.stdout}`, { cause: error });
	typeScriptError.stdout = error.stdout;
	throw typeScriptError;
  }
}

function tsConfigToCliParams(config) {
  const params = [];
  if (config.compilerOptions) {
    for (const [key, value] of Object.entries(config.compilerOptions)) {
      const serializedValue = Array.isArray(value) ? value.join(',') : value;
      params.push(`--${key}`, serializedValue);
    }
  }

  return params;
}

/**
 * @param {string} fileName
 * @param {RegExp | null} expectedError
 */
function typeTest(fileName, expectedError = null) {
  const testFunc = () => execTypeTest(fileName);
  test(fileName, () => {
    if (!expectedError) {
      assert.doesNotThrow(testFunc);
      return;
    }
    assert.throws(testFunc, expectedError);
  });
}

describe('Type Declarations', () => {
  typeTest('empty-plugin.ts');
  typeTest('complex-plugin.ts');
  typeTest('options-is-readonly.ts', /error TS2540: Cannot assign to 'someString' because it is a read-only property/);
});
