import { defineConfig } from '@playwright/test';

// Headless smoke test for the bundled board template. Serves assets/ via a tiny
// zero-dep Node server, drives Chromium, asserts render + interactions.
export default defineConfig({
  testDir: './tests',
  timeout: 20_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8753',
    browserName: 'chromium',
  },
  webServer: {
    command: 'node tests/serve.mjs',
    port: 8753,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
