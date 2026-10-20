import { test, expect } from '@playwright/test';

const PAGES: [string, string, (p: import('@playwright/test').Page) => Promise<void>][] = [
  ['01_home', '/', async () => {}],
  ['02_query_studio', '/query', async () => {}],
  ['02b_query_studio_sql', '/query?t=sql', async (p) => { await p.getByTestId('run-sql').click(); }],
  ['02c_query_studio_nl', '/query?t=nl&q=energetic%20songs%20from%20the%201980s%20with%20low%20acousticness', async () => {}],
  ['03_acoustic_map', '/map', async () => {}],
  ['04_sonic_twins', '/twins', async (p) => { await p.getByTestId('random-track').click(); await p.getByTestId('twin-results').waitFor(); }],
  ['05_compare', '/compare', async (p) => { await p.getByTestId('p-value').waitFor(); }],
  ['06_time_machine', '/time', async () => {}],
  ['07_genre_fingerprints', '/genres', async () => {}],
  ['08_lyrics_lab', '/lyrics', async () => {}],
  ['09_collaboration_network', '/network?a=Philharmonia%20Orchestra', async () => {}],
  ['10_data_profile', '/profile', async (p) => { await p.getByTestId('profile-table').waitFor(); }],
  ['10b_data_profile_ydata', '/profile?r=ydata', async () => {}],
  ['11_about', '/about', async () => {}],
];

for (const theme of ['light', 'dark'] as const) {
  for (const [name, path, act] of PAGES) {
    test(`${name} ${theme}`, async ({ page }) => {
      await page.addInitScript((t) => { try { localStorage.setItem('sa-theme', t); } catch { /* */ } }, theme);
      await page.goto('./#' + path);
      await expect(page.getByTestId('db-status')).toContainText('tracks', { timeout: 60_000 });
      await act(page);
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `screenshots/${name}_${theme}.png`, fullPage: true });
    });
  }
}

test('tablet layout', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  for (const [name, path] of [['12_tablet_home', '/'], ['13_tablet_compare', '/compare']]) {
    await page.goto('./#' + path);
    await expect(page.getByTestId('db-status')).toContainText('tracks', { timeout: 60_000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `screenshots/${name}_light.png`, fullPage: true });
  }
});
