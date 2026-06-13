import { defineConfig, devices } from '@playwright/test';

const webPort = Number(process.env.E2E_WEB_PORT || 3000);
const apiPort = Number(process.env.E2E_API_PORT || 3001);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${webPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `npm.cmd --workspace apps/api run start`,
      url: `http://localhost:${apiPort}/api/v1`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: String(apiPort),
        WEB_ORIGIN: baseURL,
      },
    },
    {
      command: `npm.cmd --workspace apps/web run dev -- --hostname localhost --port ${webPort}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL:
          process.env.NEXT_PUBLIC_API_URL ||
          `http://localhost:${apiPort}/api/v1`,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
