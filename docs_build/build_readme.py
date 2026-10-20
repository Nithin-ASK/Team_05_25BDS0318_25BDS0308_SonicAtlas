"""Generate README.md from results.json (numbers are never typed by hand)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import ROOT, R, TITLE, f, links, n, pct  # noqa: E402

r = R(); L = links()
A, C, M, DR, TS, T = r["audit"], r["cleaning"], r["multivariate"], r["dimred"], r["timeseries"], r["tests"]
LY, WEB, QA = r.get("lyrics"), r.get("web", {}), r.get("qa", {})
fl = TS["first_last"]
shots = [("01_home_light.png", "Home"), ("02_query_studio_light.png", "Query Studio"), ("03_acoustic_map_light.png", "Acoustic Map"),
         ("05_compare_light.png", "Compare"), ("06_time_machine_light.png", "Time Machine"), ("09_collaboration_network_light.png", "Network")]
shot_md = " ".join(f'<img src="web/screenshots/{s}" alt="{a}" width="32%">' for s, a in shots if (ROOT / "web" / "screenshots" / s).exists())

md = f"""<div align="center">

# SonicAtlas

**{TITLE}**

Team 05 - BACSE301 Exploratory Data Analysis - Vellore Institute of Technology, Vellore - Fall 2026

[Live website]({L['live']}) | [Demo video]({L['video']}) | [Project report](deliverables/) | [IEEE paper](deliverables/)

</div>

{shot_md}

## What and why
Spotify's archived audio descriptors (danceability, energy, valence, acousticness, ...) are one of the few open windows onto
the sound of recorded music, but most analyses of them are static charts. SonicAtlas is (1) a reproducible EDA pipeline over
**{n(A['a_rows'])} tracks** ({A['a_year_min']}-{A['a_year_max']}), **{n(C['rows_genre_tracks'])} genre-labelled tracks in
{A['g_genres']} genres**{f" and **{n(LY['rows_used'])} English lyrics**" if LY else ""}, and (2) a static website where anyone can filter,
query (SQL in the browser via DuckDB-WASM), map and compare the data - no server, no sign-up, data never leaves the browser.

## Key findings
- Music got **{f(fl['loudness'][1] - fl['loudness'][0], 1)} dB louder** between {TS['year_window'][0]} and {TS['year_window'][1]}, with loudness change points in {', '.join(map(str, TS['change_points']['loudness'][1:]))} ("loudness war"); acousticness fell from {f(fl['acousticness'][0], 2)} to {f(fl['acousticness'][1], 2)}.
- Energy is almost a restatement of loudness (Pearson r = {f(M['pairs']['loudness~energy']['pearson'], 2)}) and the opposite of acousticness (r = {f(M['pairs']['energy~acousticness']['pearson'], 2)}).
- Genre explains **{pct(100 * T['anova']['eta_squared'], 1)}** of the variance in danceability (ANOVA F = {f(T['anova']['F'], 1)}, p < 0.001), yet genres overlap in every 2-D embedding (negative genre silhouettes).
- t-SNE preserves local structure best (trustworthiness {f(DR['comparison']['t-SNE']['trustworthiness_k10'], 3)}), then UMAP ({f(DR['comparison']['UMAP']['trustworthiness_k10'], 3)}), PCA ({f(DR['comparison']['PCA']['trustworthiness_k10'], 3)}) and LLE ({f(DR['comparison']['LLE']['trustworthiness_k10'], 3)}).
""" + (f"- Lyric sentiment is nearly unrelated to musical valence (r = {f(LY['r_valence_vader'], 2)}, n = {n(LY['matched_n'])} matched songs).\n" if LY else "") + f"""
## Quick start
```bash
# Python analysis (Python 3.13)
python -m venv .venv && .venv/Scripts/activate        # Windows; use bin/activate on Linux/macOS
pip install -r requirements.txt && pip install -e .
python docs_build/download_data.py                   # public Kaggle endpoint, no token needed
python docs_build/build_notebooks.py                 # runs notebooks 01-10 (09 needs requirements-profiling.txt in .venv-profiling)
python -m sonicatlas.web_export                      # writes web/public/data
pytest -q

# Website
cd web && npm ci && npm run dev                      # http://localhost:5173
npm test && npx playwright test                      # unit + end-to-end tests
npm run build                                        # static site in web/dist
```
Documents (report, decks, paper, proof, self-check) are generated from `reports/results.json` by the scripts in `docs_build/`
(see the `Makefile`: `make report ppt paper proof plagcheck`).

## Publish on GitHub Pages
The site is already published from the `gh-pages` branch (live link above). To republish: `cd web && npm ci && npm run build`, then push the
contents of `web/dist` (plus `.nojekyll`, `404.html` copy of index.html and `data/tracks_full.bin.zip` for the optional full-data tier) to
the `gh-pages` branch, with Pages set to "Deploy from a branch". An automatic Actions workflow is provided in `deploy/` (see deploy/README.md);
GitHub needs the `workflow` permission to accept it under `.github/workflows/`.

## Tech stack
Python (pandas, scikit-learn, statsmodels, ruptures, umap-learn, networkx, VADER, TextBlob), Jupyter, YData-Profiling,
Sweetviz, D-Tale; Vite + React + TypeScript, Tailwind CSS, DuckDB-WASM, Apache ECharts; Playwright, Vitest, Lighthouse;
python-docx, pptxgenjs, LaTeX (IEEEtran) for documents.

## Repository layout
`data/` (raw data not committed; see data/README.md) - `notebooks/` (01-10, with outputs; sources in notebooks/src) -
`src/sonicatlas/` (package: stats, theme, results, web export) - `tests/` - `web/` (website) - `reports/` (figures, tables,
profiling, results.json) - `docs_build/` (document generators) - `deliverables/` (final files).

## Honest limitations
Spotify descriptors are outputs of proprietary models; the catalogue over-represents recent years; only
{pct(C['join']['match_rate_pct'])} of genre-labelled tracks could be joined to the audio table; lyrics are English-only; the 2020s
contain one year. See DECISIONS.md for every judgement call.

## Team
- Sharvesh Prabhu (25BDS0318)
- Nithin S (25BDS0308) - nithin.s2025a@vitstudent.ac.in

Course: BACSE301 Exploratory Data Analysis, VIT Vellore. Faculty: ____________.

## Licence
Code: MIT (see LICENSE). Data: see the licence of each Kaggle dataset in data/README.md; raw data and lyric text are not
redistributed.
"""
(ROOT / "README.md").write_text(md, encoding="utf-8")
(ROOT / "LICENSE").write_text("""MIT License

Copyright (c) 2026 Sharvesh Prabhu, Nithin S (Team 05)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
""", encoding="utf-8")
print("README.md written")
