import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

test.use({ video: { mode: 'on', size: { width: 1280, height: 720 } }, viewport: { width: 1280, height: 720 } });

async function caption(page: Page, text: string, ms = 4000) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, {
        position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', zIndex: '9999', maxWidth: '920px',
        background: 'rgba(10,14,22,0.88)', color: '#fff', padding: '12px 20px', borderRadius: '12px', font: '600 18px/1.4 Inter, Segoe UI, sans-serif',
        boxShadow: '0 8px 30px rgba(0,0,0,.35)', textAlign: 'center', pointerEvents: 'none',
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  await page.waitForTimeout(ms);
}

async function go(page: Page, path: string) {
  await page.goto('./#' + path);
  await expect(page.getByTestId('db-status')).toContainText('tracks', { timeout: 60_000 });
}

test('SonicAtlas demo walkthrough', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('sa-theme', 'light'); } catch { /* */ } });
  await go(page, '/');
  await caption(page, 'SonicAtlas: explore ~150,000 Spotify tracks with SQL that runs entirely in your browser (DuckDB-WASM)', 6000);
  await page.mouse.wheel(0, 600);
  await caption(page, 'Headline stats and three key findings are read straight from the analysis summary', 5000);
  await page.mouse.wheel(0, -600);

  await go(page, '/query');
  await caption(page, 'Query Studio: every slider and filter generates SQL live', 4000);
  await page.getByLabel('Artist contains').pressSequentially('Queen', { delay: 120 });
  await page.getByRole('radio', { name: 'Minor' }).click();
  await caption(page, 'Results update in milliseconds; the URL captures the filter so the view is shareable', 5000);
  await page.getByRole('radio', { name: 'SQL console' }).click();
  await page.getByRole('button', { name: 'Average features by decade' }).click();
  await caption(page, 'SQL console with column autocomplete, examples, history and CSV / JSON / Parquet export', 5000);
  await page.getByRole('radio', { name: 'Plain English' }).click();
  await page.getByTestId('nl-input').pressSequentially('energetic songs from the 1980s with low acousticness', { delay: 40 });
  await page.getByRole('button', { name: /Translate/ }).click();
  await caption(page, 'Plain English is translated by a transparent rule-based parser - you always see the SQL', 6500);

  await go(page, '/map');
  await caption(page, 'Acoustic Map: PCA, t-SNE, LLE and UMAP embeddings of 10,000 genre-labelled tracks', 4500);
  await page.getByRole('radio', { name: 'UMAP' }).click();
  await caption(page, 'Switch methods, colour by cluster, genre or any feature; box / lasso select and click to find twins', 5000);

  await go(page, '/twins');
  await page.getByTestId('twin-search').pressSequentially('Somewhere', { delay: 80 });
  await page.waitForTimeout(1200);
  await page.getByRole('list', { name: 'Search results' }).getByRole('button').first().click();
  await caption(page, 'Sonic Twins: nearest tracks by cosine similarity on min-max scaled features, with a radar comparison', 6000);

  await go(page, '/compare');
  await caption(page, 'Compare: live Welch t-test, Mann-Whitney U and effect sizes, implemented and unit-tested in TypeScript', 6500);
  await page.mouse.wheel(0, 700);
  await caption(page, 'Boxplots with Tukey hinges, KDE densities, and a stats table with G1 skewness and G2 kurtosis', 5000);
  await go(page, '/compare?by=decade&g=["1960","1990","2010"]&f=loudness');
  await caption(page, 'Three groups switch to one-way ANOVA with eta squared - here: loudness across decades', 6500);

  await go(page, '/time');
  await caption(page, 'Time Machine: yearly trends with detected change points (dashed)', 4500);
  await page.mouse.wheel(0, 900);
  await page.getByTestId('play-decades').click();
  await caption(page, 'Press Play to animate decade means from the 1950s to the 2020s', 10000);

  await go(page, '/genres');
  await caption(page, 'Genre Fingerprints: parallel coordinates with brushing, radar profiles and Andrews curves', 6500);

  await go(page, '/lyrics');
  await caption(page, 'Lyrics Lab: n-grams, sentiment by tag and decade, and lyric sentiment vs audio valence', 6500);

  await go(page, '/network?a=Philharmonia%20Orchestra');
  await caption(page, 'Collaboration Network: Louvain communities; click an artist to see its audio signature', 6500);

  await go(page, '/profile');
  await caption(page, 'Data Profile: quick profile of any query result plus the YData and Sweetviz reports', 5000);

  await go(page, '/about');
  await page.getByTestId('theme-toggle').click();
  await caption(page, 'Dark and light themes, colour-blind-safe Okabe-Ito palette, keyboard accessible', 4500);
  await caption(page, 'SonicAtlas - Team 05, VIT Vellore - BACSE301 Exploratory Data Analysis', 6000);

  const video = page.video();
  await page.close();
  if (video) {
    fs.mkdirSync('demo', { recursive: true });
    await video.saveAs('demo/demo.webm');
  }
});
