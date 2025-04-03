import { defineConfig } from 'eslint/config';
import globals from 'globals';
import vitest from 'eslint-plugin-vitest';

export default defineConfig([
  {
    ignores: ['dist/**/*']
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest
      }
    },
    plugins: {
      vitest
    },
    rules: {
      // Base rules
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      'no-undef': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Best practices
      'no-useless-catch': 'error',
      'no-constant-condition': 'error'
    }
  },
  {
    files: ['**/*.test.js', '**/test/**/*.js', 'viteCustomPlugins/**/*.js'],
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off'
    }
  },
  {
    files: ['vite.config.js'],
    rules: {
      'no-unused-vars': 'off'
    }
  }
]);
