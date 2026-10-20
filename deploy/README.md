# Deployment

The site is published from the `gh-pages` branch (Settings -> Pages -> Source: Deploy from a branch -> gh-pages).

`deploy-pages.yml.example` is a GitHub Actions workflow that builds `web/` and deploys it automatically. It could not be pushed
with the first login (GitHub requires the `workflow` permission for files under `.github/workflows/`). To enable it:
1. `gh auth refresh -s workflow` (approve the code in the browser).
2. `mkdir -p .github/workflows && git mv deploy/deploy-pages.yml.example .github/workflows/deploy-pages.yml`
3. Commit and push, then set Pages Source to "GitHub Actions".

Manual publish: `cd web && npm ci && npm run build`, then push the contents of `web/dist` to the `gh-pages` branch.
