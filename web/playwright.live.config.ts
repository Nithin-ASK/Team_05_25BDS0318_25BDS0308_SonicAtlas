// Runs the same end-to-end tests against the LIVE GitHub Pages site (no local server).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /(app|live)\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 45_000 },
  workers: 1,
  retries: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/live-results.json' }]],
  use: { baseURL: process.env.LIVE_URL || 'https://nithin-ask.github.io/Team_05_25BDS0318_25BDS0308_SonicAtlas/', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
});
