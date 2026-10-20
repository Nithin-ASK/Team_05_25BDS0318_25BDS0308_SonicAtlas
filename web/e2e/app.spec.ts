import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

const PAGES = [
  ['/', 'Explore a century of music'],
  ['/query', 'Ask the catalogue anything'],
  ['/map', 'The shape of sound'],
  ['/twins', 'Find tracks that sound alike'],
  ['/compare', 'Are these groups really different?'],
  ['/time', 'How music changed'],
  ['/genres', 'What does a genre sound like?'],
  ['/lyrics', 'What the words say'],
  ['/network', 'Who plays with whom'],
  ['/profile', 'Know your data before you trust it'],
  ['/about', 'How SonicAtlas was built'],
] as const;

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function waitForDb(page: Page) {
  await expect(page.getByTestId('db-status')).toContainText('tracks', { timeout: 60_000 });
}

test('home loads with headline stats and findings', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./#/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Explore a century of music');
  await expect(page.getByText('Tracks analysed')).toBeVisible();
  await expect(page.getByText('Three key findings')).toBeVisible();
  await expect(page.getByText('The loudness war is real')).toBeVisible();
  await waitForDb(page);
  expect(errors).toEqual([]);
});

test('SQL console runs a query and shows rows', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./#/query?t=sql');
  await waitForDb(page);
  await page.getByTestId('run-sql').click();
  await expect(page.getByTestId('query-meta')).toContainText('rows', { timeout: 30_000 });
  await expect(page.getByTestId('results-table').locator('tbody tr').first()).toBeVisible();
  const meta = await page.getByTestId('query-meta').innerText();
  const ms = Number(/([\d.]+) ms/.exec(meta)?.[1]);
  console.log('SQL console query time (ms):', ms);
  expect(ms).toBeLessThan(1000);
  expect(errors).toEqual([]);
});

test('visual filter builder applies a filter', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./#/query');
  await waitForDb(page);
  await page.getByLabel('Artist contains').fill('Queen');
  await expect(page.getByTestId('builder-sql')).toContainText("artist ILIKE '%Queen%'");
  await page.getByRole('radio', { name: 'Explicit' }).first().click();
  await page.getByRole('radio', { name: 'Clean' }).click();
  await expect(page.getByTestId('builder-sql')).toContainText('NOT explicit');
  await expect(page.getByTestId('results-table').locator('tbody tr').first()).toBeVisible();
  await expect(page.getByTestId('results-table')).toContainText('Queen');
  expect(page.url()).toContain('f=');
  expect(errors).toEqual([]);
});

test('plain-English query generates SQL', async ({ page }) => {
  await page.goto('./#/query?t=nl');
  await waitForDb(page);
  await page.getByTestId('nl-input').fill('energetic songs from the 1980s with low acousticness');
  await expect(page.getByTestId('nl-sql')).toContainText('year BETWEEN 1980 AND 1989');
  await expect(page.getByTestId('nl-sql')).toContainText('energy >= 0.7');
  await page.getByRole('button', { name: /Translate/ }).click();
  await expect(page.getByTestId('results-table').locator('tbody tr').first()).toBeVisible();
});

test('Compare shows a p-value', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./#/compare');
  await waitForDb(page);
  await expect(page.getByTestId('p-value')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('p-value')).not.toHaveText('');
  await expect(page.getByTestId('stats-table')).toContainText('classical');
  // three groups -> ANOVA
  await page.goto('./#/compare?by=cluster&g=["0","1","2"]&f=danceability');
  await expect(page.getByText('p-value (ANOVA)')).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('Sonic Twins returns matches', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./#/twins');
  await waitForDb(page);
  await page.getByTestId('random-track').click();
  await expect(page.getByTestId('twin-target')).toBeVisible();
  await expect(page.getByTestId('twin-results').locator('tbody tr')).toHaveCount(10, { timeout: 30_000 });
  await expect(page.getByTestId('twin-meta')).toContainText('25 matches');
  expect(errors).toEqual([]);
});

test('every page renders without console errors', async ({ page }) => {
  const errors = collectErrors(page);
  for (const [path, heading] of PAGES) {
    await page.goto('./#' + path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    await page.waitForTimeout(2500);
  }
  expect(errors).toEqual([]);
});

test('theme toggle switches to dark', async ({ page }) => {
  await page.goto('./#/about');
  const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await page.getByTestId('theme-toggle').click();
  const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  expect(after).toBe(!before);
});
