import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'dist-e2e/', 'coverage/', 'legacy/', 'playwright-report/', 'test-results/'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // The production CSP forbids inline HTML injection paths; use DOM APIs.
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use textContent and DOM APIs instead.' },
        { property: 'outerHTML', message: 'Use textContent and DOM APIs instead.' },
        { property: 'insertAdjacentHTML', message: 'Use DOM APIs instead.' },
      ],
    },
  },
  {
    // Game rules must stay engine-free so they can be unit tested (Star Destroyer ADR-006).
    files: ['src/logic/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['phaser', 'phaser/*'] }],
    },
  },
  {
    files: ['scripts/**/*.js', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
