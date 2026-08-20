import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'supabase/.temp/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['*.config.{js,ts}', 'tests/e2e/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/auth/AuthProvider.tsx', 'src/components/ToastProvider.tsx'],
    rules: {
      // Estos módulos exportan deliberadamente Provider + hook del mismo contexto.
      'react-refresh/only-export-components': 'off',
    },
  },
);
