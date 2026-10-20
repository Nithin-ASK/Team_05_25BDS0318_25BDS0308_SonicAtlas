# Testing and measurements (20 Oct 2026)

| Check | Result | How to reproduce |
|---|---|---|
| Unit tests (Vitest) | 65 / 65 pass (stats, p-values, Andrews curves, SQL builder, plain-English parser) | `npm test` |
| End-to-end (Playwright, Chromium) | 8 / 8 pass; every page renders with no console errors | `npx playwright test e2e/app.spec.ts` |
| SQL console query time | 4.7 ms (one measured query on the 150,000-track lite table) | printed by the e2e test |
| Lighthouse (desktop) | accessibility 96-100, best practices 100, SEO 100; performance 99 on Home / Query Studio / About, **75 on Compare** (largest contentful paint 17.4 s on a cold start while the Parquet file downloads) | `node scripts/lighthouse.mjs` (needs `npm run preview`) |
| Python tests | 7 / 7 pass | `pytest -q` in the project root |

Lighthouse reports are in `web/lighthouse/`, screenshots in `web/screenshots/`, demo video in `web/demo/`.
Known gap: the Compare page waits for the data download before its first large chart; a loading skeleton shows meanwhile.
