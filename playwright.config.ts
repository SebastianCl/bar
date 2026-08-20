import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

const environmentFromFiles = loadEnv(
  process.env.VITE_APP_ENV ?? 'development',
  process.cwd(),
  '',
);

for (const name of [
  'VITE_APP_ENV',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'PLAYWRIGHT_BASE_URL',
  'E2E_REQUIRE_ENV',
  'E2E_EMAIL',
  'E2E_PASSWORD',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
]) {
  process.env[name] ??= environmentFromFiles[name];
}

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const localBaseUrl = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: externalBaseUrl ?? localBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-360x800',
      use: { browserName: 'chromium', viewport: { width: 360, height: 800 } },
    },
    {
      name: 'tablet-768x1024',
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-1440x900',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'pnpm run build && pnpm run preview',
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
