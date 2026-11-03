// @ts-check
/**
 * SIPLAD — Configuracion de ESLint (formato plano).
 *
 * ESLint 9 sustituyo el archivo .eslintrc por este formato, llamado "flat
 * config". Ya no existe herencia por cascada ni la clave "extends": la
 * configuracion es un arreglo de objetos que se aplican en orden, y el
 * ultimo que coincide con un archivo gana.
 */
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default tseslint.config(
  // ---------------------------------------------------------------------
  // 1. Archivos que ESLint no debe revisar
  // ---------------------------------------------------------------------
  //
  // Los patrones llevan el prefijo '**/' de forma deliberada. En la
  // configuracion plana las rutas se resuelven contra el directorio desde el
  // que se invoca ESLint, no contra la ubicacion de este archivo. Sin ese
  // prefijo, las exclusiones dejan de aplicar cuando la orden se ejecuta
  // desde la raiz del repositorio, como lo hace el hook de pre-commit.
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/uploads/**',
      // El cliente de Prisma es codigo generado: no se corrige a mano.
      '**/generated/**',
      '**/eslint.config.mjs',
    ],
  },

  // ---------------------------------------------------------------------
  // 2. Reglas base de JavaScript y de TypeScript con informacion de tipos
  // ---------------------------------------------------------------------
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // ---------------------------------------------------------------------
  // 3. Entorno del proyecto
  // ---------------------------------------------------------------------
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        // Habilita las reglas que necesitan conocer los tipos reales.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ---------------------------------------------------------------------
  // 4. Ajustes propios del proyecto
  // ---------------------------------------------------------------------
  {
    rules: {
      // NestJS depende de decoradores y de metadatos en tiempo de ejecucion;
      // algunas construcciones que ESLint marcaria son idiomaticas aqui.
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // El uso de 'any' se permite, pero queda visible como advertencia para
      // que no se extienda sin que nadie lo note.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Una promesa sin esperar dentro de un servicio es un defecto real:
      // el error se pierde y la peticion responde antes de tiempo.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Variables sin usar: se permiten los argumentos que empiezan con
      // guion bajo, convencion para parametros requeridos por una firma.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Seguridad: delata una credencial dejada en el codigo por descuido.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // ---------------------------------------------------------------------
  // 5. Excepciones para los archivos de prueba y de siembra
  // ---------------------------------------------------------------------
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**/*.ts'],
    rules: {
      // Los dobles de prueba usan 'any' de forma legitima.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['**/prisma/seed.ts'],
    rules: {
      // La siembra informa su progreso por consola de forma deliberada.
      'no-console': 'off',
    },
  },

  // ---------------------------------------------------------------------
  // 6. Prettier al final: desactiva las reglas de ESLint que chocan con el
  //    formateador y delega el formato en el.
  // ---------------------------------------------------------------------
  eslintPluginPrettier,
);
