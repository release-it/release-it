import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'eslint-plugin-prettier';
import _import from 'eslint-plugin-import-x';
import { fixupConfigRules } from '@eslint/compat';
import globals from 'globals';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  ...fixupConfigRules(compat.extends('eslint:recommended', 'plugin:ava/recommended', 'prettier')),
  {
    plugins: {
      prettier,
      import: _import
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es6
      },
      ecmaVersion: 2020,
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'prettier/prettier': 2,
      'ava/no-ignored-test-files': 0,
      'ava/no-import-test-files': 0,
      'import/no-unresolved': [2, { ignore: ['ava', '@octokit/rest', '@octokit/request-error'] }],
      'import/no-unused-modules': 2,
      'import/order': [2, { 'newlines-between': 'never' }]
    }
  }
];
