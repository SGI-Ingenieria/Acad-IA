import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100'
const externalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1'

export default defineConfig({
  testDir: './tests/visual',
  outputDir: './test-results/visual',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'line',
  globalSetup: './tests/visual/global-setup.ts',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.002,
      stylePath: './tests/visual/screenshot.css',
    },
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-light',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'desktop-dark',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-light',
      use: { ...devices['Pixel 7'], colorScheme: 'light' },
    },
    {
      name: 'mobile-dark',
      use: { ...devices['Pixel 7'], colorScheme: 'dark' },
    },
  ],
  webServer: externalServer
    ? undefined
    : {
        command: 'bunx vite --host 127.0.0.1 --port 3100',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          ACADIA_DISABLE_DEVTOOLS: '1',
          VITE_DISABLE_DEVTOOLS: '1',
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? '',
          VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? '',
        },
      },
})
