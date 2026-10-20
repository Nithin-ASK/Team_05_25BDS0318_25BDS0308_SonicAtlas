import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// Full-page screenshots of the live site (light theme), saved next to the local ones.
const PAGES: [string, string][] = [['', 'home'], ['query', 'query_studio'], ['map', 'acoustic_map'], ['compare', 'compare'], ['time', 'time_machine'], ['network', 'network']];
test('live screenshots', async ({ page }) => {
  fs.mkdirSync('screenshots_live', { recursive: true });
  for (const [route, name] of PAGES) {
    await page.goto(`./#/${route}`);
    await expect(page.getByTestId('db-status')).toContainText('tracks', { timeout: 60_000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `screenshots_live/live_${name}.png`, fullPage: false });
  }
});

test('full dataset tier loads on the live site', async ({ page }) => {
  await page.goto('./#/query?t=sql');
  await expect(page.getByTestId('db-status')).toContainText('tracks', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Load full dataset' }).click();
  await expect(page.getByTestId('db-status')).toContainText('1,204,025', { timeout: 180_000 });
  await page.getByTestId('run-sql').click();
  await expect(page.getByTestId('query-meta')).toContainText('rows', { timeout: 60_000 });
  console.log('full-data status:', await page.getByTestId('db-status').innerText());
});
