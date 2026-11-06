import { defineConfig, devices } from '@playwright/test'
import { loadTestEnv } from './tests/support/env.ts'

loadTestEnv()

const port = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://127.0.0.1:${port}`
const databaseUrl =
  process.env.E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    'E2E_DATABASE_URL or TEST_DATABASE_URL is required to run Playwright tests.',
  )
}

const prepareDatabase = 'pnpm exec tsx tests/e2e/prepare-database.ts'
const isDevServer = process.env.E2E_DEV === '1'
const skipBuild = process.env.E2E_SKIP_BUILD === '1'
const startCommand = isDevServer
  ? `pnpm exec next dev -p ${port}`
  : `pnpm exec next start -p ${port}`
const buildCommand = isDevServer || skipBuild ? '' : 'pnpm build && '

const serverEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  APP_URL: baseURL,
  NEXT_TELEMETRY_DISABLED: '1',
  CRON_SECRET: 'e2e-cron-secret',
  RESEND_API_KEY: '',
  EMAIL_FROM: '',
  BLOB_READ_WRITE_TOKEN: '',
  LOGIN_TRUSTED_IP_HEADER: 'x-forwarded-for',
} as Record<string, string>

const projects = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
]

if (process.env.E2E_ALL_BROWSERS === '1') {
  projects.push(
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  )
}

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    extraHTTPHeaders: {
      'x-forwarded-for': '127.0.0.1',
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `${prepareDatabase} && ${buildCommand}${startCommand}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: serverEnv,
  },
  projects,
})
