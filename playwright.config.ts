import { defineConfig, devices } from '@playwright/test';

const PORT = 4176;
const isCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Two browsers at a time everywhere (owner, 2026-10-21): the dev machine is shared by several
  // game sessions, and Playwright's default (half the cores) starts 6 here. GitHub's runners
  // have 4 cores, where the default was already 2.
  workers: 2,
  forbidOnly: isCI,
  retries: 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  // Each check may wait up to 10 s (Playwright's default is 5 s). Since the audio (M3.6) the
  // first load takes longer, and shared CI and dev machines often run at high load.
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    // The e2e build is the normal build plus the test hook (src/debug/testHook.ts).
    command: `npm run build:e2e && vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
