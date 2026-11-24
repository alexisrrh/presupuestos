import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createLocalDemoGuard } from './config/localDemoGuard.js'

export default defineConfig((environment) => ({
  plugins: [createLocalDemoGuard(environment), react(), tailwindcss()],
  ...(environment.mode === 'local-demo' ? { server: { host: '127.0.0.1', strictPort: true, port: 5173 } } : {}),
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
  // The demo is a development entry only. The guard rejects build --mode local-demo.
  build: { rollupOptions: { input: 'index.html' } },
}))
