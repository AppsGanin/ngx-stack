// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    // Build output and generated files are nobody's business.
    ignores: ['dist/**', 'node_modules/**', '.angular/**', 'coverage/**'],
  },

  // ---------------------------------------------------------------- TypeScript
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      // Last, so it can switch off every rule that argues with Prettier about formatting.
      // Formatting is Prettier's job; ESLint's job is correctness.
      prettier,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // The library is a public API. An implicit `any` leaking into a signature is a bug that only
      // shows up in someone else's editor.
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // ------------------------------------------------------------------- Library
  {
    files: ['projects/ngx-stack/**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'ngx', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'ngx', style: 'camelCase' },
      ],
    },
  },

  // ---------------------------------------------------------------------- Demo
  {
    files: ['projects/demo/**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: ['demo', 'app'], style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', style: 'camelCase' }],
    },
  },

  // ------------------------------------------------------------------ Templates
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },

  // ----------------------------------------------------------------- Test & e2e
  {
    files: ['**/*.spec.ts', 'e2e/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
);
