// @ts-check
/**
 * SIPLAD — Configuración de ESLint del frontend.
 *
 * Mismo criterio que el backend: formato plano, reglas con información de
 * tipos y patrones prefijados con '**​/' para que las exclusiones sigan
 * aplicando cuando el hook de pre-commit invoca ESLint desde la raíz del
 * repositorio.
 */
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/eslint.config.js',
      '**/vite.config.ts',
      // Guiones de Node para la prueba de humo: viven fuera del proyecto de
      // TypeScript de la aplicacion, asi que el analizador con informacion de
      // tipos no puede resolverlos.
      '**/pruebas/**',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        // En React es idiomático pasar una función asíncrona a un manejador
        // de evento; lo que importa es que la promesa no quede sin atender.
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  eslintPluginPrettier,
);
