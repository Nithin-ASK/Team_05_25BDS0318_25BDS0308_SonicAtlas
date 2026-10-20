# DECISIONS

1. **Python 3.13 venv** (`.venv`) instead of system 3.14 - some scientific wheels lag behind the newest Python.
2. **Kaggle data without a token** - no `~/.kaggle/kaggle.json` was present. The public Kaggle download endpoint
   (`https://www.kaggle.com/api/v1/datasets/download/<owner>/<slug>`) served the public datasets without login, so
   the original datasets were used (no mirror needed). No credentials were used or bypassed.
3. **Tukey quartiles** - Tukey's original hinges: split at the median; for odd n the median is part of both halves.
   For the even-n tutorial data (4,5,5,6,6,6,7,8,9,14) this gives Q1=5, Q3=8. The pandas default (linear
   interpolation) is reported alongside as `q1_pandas`/`q3_pandas`; the report uses Tukey values.
4. **Office for PDF export** - LibreOffice is not installed; Microsoft Word/PowerPoint (installed) are used through COM
   automation to export .docx/.pptx to PDF.
5. **Seed 42** everywhere (`sonicatlas.SEED`).
6. **Genre analyses use the genre table directly** - only 10.7% of its tracks match the 1.2M table (ID or title+artist),
   so genre x decade questions rest on 9,644 tracks; reported honestly everywhere.
7. **Re-issues** - earliest release per normalised title + main artist is `is_canonical`; time trends use canonical rows only.
8. **Outliers are flagged, never dropped** (`is_outlier` = Isolation Forest, 2% contamination; per-feature IQR flags in nb 02).
9. **Popularity is not log-transformed** - it is a bounded 0-100 score with many zeros; log1p increased skew. Genius page
   views (a true count) are log-transformed in nb 07 instead.
10. **Stratified samples** - t-SNE/LLE/UMAP on 10,000 tracks (up to 90 per genre, all 114 genres); trustworthiness on 3,000
    of them; decade t-SNE on 1,000 canonical tracks per decade; HDBSCAN on 20,000; correlations on 300,000.
11. **k = 6 for KMeans** - silhouette peaks at k = 2 (acoustic vs electric only); k = 6 is on the next plateau and gives
    nameable groups.
12. **Licences** - two Kaggle datasets state licence "Unknown"; lyrics text is not redistributed, only aggregates.
13. **Profiling tools in a separate venv** (`.venv-profiling`) - ydata-profiling/sweetviz/dtale pin older pandas.
14. **Charts: ECharts instead of Plotly** in the website - smaller bundle; same chart types (scatter, parallel, radar, graph).
15. **IEEE templates** - ieee.org template downloads answer automated requests with a bot challenge (HTTP 202, empty body),
    which was not bypassed. The paper uses the official IEEEtran class v1.8b from CTAN (bare_conf conference mode, compiled
    with Tectonic 0.17 in tools/). The Word version is a careful python-docx copy of the IEEE conference layout (A4, two
    columns, Times New Roman 10 pt). The team can paste the text into IEEE's Word template by hand if a venue requires it.
