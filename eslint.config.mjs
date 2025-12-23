import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  ...fixupConfigRules(compat.extends('eslint:recommended')),
  {
    plugins: {
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
      'import/no-unresolved': [2, { ignore: ['@octokit/rest', '@octokit/request-error', 'c12'] }],
      'import/no-unused-modules': 2,
      'import/order': [2, { 'newlines-between': 'never' }]
    }
  }
];
