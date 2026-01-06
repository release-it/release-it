import _import from 'eslint-plugin-import-x';
import globals from 'globals';
import js from '@eslint/js';

export default [
  js.configs.recommended,
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
