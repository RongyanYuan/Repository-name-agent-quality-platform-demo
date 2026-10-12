import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testSetup.ts'],
    globals: true,
    css: true,
    maxWorkers: 2,
    fileParallelism: false,
    testTimeout: 20000,
    exclude: ['**/node_modules/**', '**/e2e/**']
  }
})
