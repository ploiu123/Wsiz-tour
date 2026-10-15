// Sprawdzanie kodu (npm run lint). Najważniejsza reguła na czas migracji: no-undef wyłapuje brakujące importy.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['dist/', 'dist-test/', 'node_modules/', 'film/', 'prezentacja-strona/', 'druk/', 'pytania/', '.agents/', '.claude/', 'test-results/', 'playwright-report/'] },
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, __TEST_HOOKS__: 'readonly' } },
  },
  {
    // kod przeniesiony 1:1 z dawnego index.html: na razie tylko błędy, nie styl
    files: ['src/legacy/**/*.js'],
    rules: { 'no-unused-vars': 'off', 'no-empty': 'off', 'no-cond-assign': 'off', 'no-sparse-arrays': 'off' },
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended],
    rules: { '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, varsIgnorePattern: '^_' }] },
  },
  { files: ['*.config.js', 'tests/**/*.js', 'tools/**/*.mjs'], languageOptions: { globals: { ...globals.node } } },
);
