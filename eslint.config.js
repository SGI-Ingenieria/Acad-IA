// @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import eslintConfigPrettier from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import unusedImports from 'eslint-plugin-unused-imports'

export default [

  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.vite/**',
      '**/pnpm-lock.yaml',
      '**/package-lock.json',
      '**/bun.lock', // Agregado bun.lock
      'src/routeTree.gen.ts',
    ],
  },

  // 2. CONFIGURACIÓN BASE
  ...tanstackConfig,

  // 3. TUS REGLAS Y CONFIGURACIÓN "PRO"
  {
    // Opcional: Puedes ser explícito sobre dónde aplicar esto
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      'jsx-a11y': jsxA11y,
      'unused-imports': unusedImports,
      'react-hooks': reactHooks,
    },
    // Configuración robusta del Resolver (La versión de Copilot)
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true, // Busca definiciones @types aunque no importes el archivo
          project: ['./tsconfig.json'],
        },
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
      },
    },
    rules: {
      // --- REGLAS DE ACCESIBILIDAD (A11Y) ---
      // Activamos las recomendadas manualmente
      ...jsxA11y.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // --- ORDEN DE IMPORTS ---
      'sort-imports': 'off', // Apagamos el nativo
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // --- LIMPIEZA DE IMPORTS NO USADOS ---
      'no-unused-vars': 'off', // Apagamos la regla base de ESLint para que no choque
      'unused-imports/no-unused-imports': 'error', // Si no se usa, marca error (y --fix lo borra)
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_', // Ignora variables que empiecen con _
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },

  // 4. PARCHE PARA ARCHIVOS DE CONFIGURACIÓN
  {
    files: [
      'eslint.config.js',
      'vite.config.ts',
      'prettier.config.js',
      '*.config.js',
    ],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
    rules: {
      // --- LA LISTA NUCLEAR (Apagamos todo lo que pida tipos) ---
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/prefer-reduce-type-parameter': 'off',
      '@typescript-eslint/prefer-string-starts-ends-with': 'off',
      '@typescript-eslint/require-await': 'off', // <--- La culpable de este último error
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  // 5. OVERRIDE: desactivar reglas para tipos generados por supabase
  {
    files: ['src/types/supabase.ts'],
    rules: {
      '@typescript-eslint/naming-convention': 'off',
    },
  },

  // 6. PRETTIER AL FINAL
  eslintConfigPrettier,
]
