# Testing and measurements (20 Oct 2026)

| Check | Result | How to reproduce |
|---|---|---|
| Unit tests (Vitest) | 65 / 65 pass (stats, p-values, Andrews curves, SQL builder, plain-English parser) | `npm test` |
| End-to-end (Playwright, Chromium) | 8 / 8 pass; every page renders with no console errors | `npx playwright test e2e/app.spec.ts` |
| SQL console query time | 4.7 ms (one measured query on the 150,000-track lite table) | printed by the e2e test |
| Lighthouse (desktop, 4 pages) | performance 98-99; accessibility, best practices and SEO all 100. Compare first scored 75 (layout shift while data loaded); fixed by matching the loading skeleton to the final layout (CLS 0.318 -> 0.056, score 99) | `node scripts/lighthouse.mjs` (needs `npm run preview`) |
| Python tests | 7 / 7 pass | `pytest -q` in the project root |

Lighthouse reports are in `web/lighthouse/`, screenshots in `web/screenshots/`, demo video in `web/demo/`.
