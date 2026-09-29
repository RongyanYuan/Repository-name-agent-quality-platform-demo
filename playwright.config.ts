import { defineConfig, devices } from '@playwright/test'

const environment = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const baseURL = environment.BASE_URL ?? 'http://127.0.0.1:4174'
const serverAddress = /^https?:\/\/([^/:]+)(?::(\d+))?/.exec(baseURL)
const serverHost = serverAddress?.[1] ?? '127.0.0.1'
const serverPort = Number(serverAddress?.[2] ?? 4174)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: {
    command: `./node_modules/.bin/vite --host ${serverHost} --port ${serverPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: Boolean(environment.PW_REUSE_SERVER)
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
