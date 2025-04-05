import js from '@eslint/js';
import globals from 'globals';
import vitestPlugin from 'eslint-plugin-vitest';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettierConfig,
  {
    ignores: ['dist/**/*']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  {
    files: ['**/*.test.js', '**/test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest
      }
    },
    plugins: {
      vitest: vitestPlugin
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'vitest/expect-expect': [
        'error',
        {
          assertFunctionNames: ['expect', 'assert*', 'check*', 'test.each', 'testAccessibility']
        }
      ],
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
      'no-console': 'off'
    }
  }
];
