import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { loadTestEnv } from './tests/support/env.ts'

loadTestEnv()

const serverOnlyStub = fileURLToPath(
  new URL('./tests/support/server-only.ts', import.meta.url),
)

const testDatabaseUrl = process.env.TEST_DATABASE_URL

const serverEnv = testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {}

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': serverOnlyStub,
    },
  },
  test: {
    reporters: process.env.CI ? ['dot', 'github-actions'] : ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.browser.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/app/**/layout.tsx',
        'src/app/**/page.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',
      ],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
          exclude: ['src/**/*.db.test.ts'],
          env: serverEnv,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.db.test.ts', 'tests/integration/**/*.test.ts'],
          globalSetup: ['./tests/support/global-setup.ts'],
          setupFiles: ['./tests/support/database-setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
          env: serverEnv,
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: [
            'src/**/*.browser.test.tsx',
            'tests/browser/**/*.browser.test.tsx',
          ],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
