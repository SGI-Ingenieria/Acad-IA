import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // El event bus de devtools escucha en un puerto fijo (42069); un segundo
    // dev server simultáneo (p. ej. desde un worktree) debe poder arrancar
    // sin él.
    ...(process.env.ACADIA_DISABLE_DEVTOOLS === '1' ? [] : [devtools()]),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // El node_modules gestionado por Deno (node_modules/.deno/*) expone una
    // copia física distinta de React. Algunas deps (p. ej. @tanstack/react-form
    // vía @tanstack/react-store) la resuelven en lugar de la copia hoisteada por
    // bun, y el optimizador de Vite acaba incrustando un segundo React. Como
    // react-dom instala el dispatcher de hooks solo en una copia, la otra ve
    // `ReactSharedInternals.H === null` y cualquier hook (useId de Radix/Form)
    // revienta con "Cannot read properties of null (reading 'useId')".
    // `dedupe` fuerza a que todo `react`/`react-dom` resuelva a la copia única.
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }
          if (
            id.includes('/node_modules/@tanstack/react-router') ||
            id.includes('/node_modules/@tanstack/router-core') ||
            id.includes('/node_modules/@tanstack/history')
          ) {
            return 'tanstack-router'
          }
          if (
            id.includes('/node_modules/@tanstack/react-query') ||
            id.includes('/node_modules/@tanstack/query-core')
          ) {
            return 'tanstack-query'
          }
          if (
            id.includes('/node_modules/@radix-ui/') ||
            id.includes('/node_modules/radix-ui/')
          ) {
            return 'radix-ui'
          }
          if (id.includes('/node_modules/@supabase/')) {
            return 'supabase'
          }
        },
      },
    },
  },
})
