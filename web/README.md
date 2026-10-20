# SonicAtlas website
Vite + React + TypeScript + Tailwind, DuckDB-WASM (Parquet in the browser), Apache ECharts.

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # static site in dist/
npm run preview    # http://localhost:4173
npx playwright install chromium && npx playwright test e2e/app.spec.ts
```
Data files live in `public/data/` (written by `python -m sonicatlas.web_export` in the project root). The optional full
dataset (1.2M tracks, 64 MB Parquet) is loaded from `FULL_DATA_URL` in `src/config.ts`; publish it as a GitHub Release asset.
Deploy: `.github/workflows/deploy-pages.yml` (Settings -> Pages -> Source: GitHub Actions). See TESTING.md for results.
