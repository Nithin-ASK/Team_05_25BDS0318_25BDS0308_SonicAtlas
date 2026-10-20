# PROGRESS - SonicAtlas (Team 05)

## Milestone A - DONE (20 Oct 2026, ~12:40 IST)
**Milestone A ready - Report and Review-2 PPT can be submitted now.**

- Data: 3 public Kaggle datasets downloaded (no token needed), audited, cleaned (notebooks 01-02).
- Analysis notebooks 01-10 all run top to bottom ("Restart and Run All" via `docs_build/build_notebooks.py`); log in `notebooks/run_log.txt`.
- `deliverables/Team_05_25BDS0318_25BDS0308_Project_Report.docx/.pdf` - 44 pages, faculty TOC with real page numbers, 25 verified papers + 18 software/data refs.
- `deliverables/Team_05_25BDS0318_25BDS0308_Review2_PPT.pptx/.pdf` - 10 slides, rendered and checked.
- `deliverables/Team_05_25BDS0318_25BDS0308_Email_Drafts.txt` - drafts 1-3 (not sent).
- First IEEE paper build (6 pages, IEEEtran via Tectonic) and number cross-check (`docs_build/check_numbers.py`: all facts match).
- pytest: 7/7 pass.

## Milestone B / C - in progress
- Website (Vite + React + DuckDB-WASM) being built in `web/`.
- Next: Review-3 PPT, Final PPT, Review-1 bonus, Outcome Proof, Plagiarism self-check, Source zip, Checklist, README.

## Status at usage-limit stop (20 Oct 2026)
Done and checked: Report (44 pp), Review-2 PPT, IEEE paper (6 pp, all automated IEEE checks pass) + .docx + LaTeX zip,
Plagiarism self-check report (report 0.18%, paper 0%, decks 0%; web check: 0 prose matches), Outcome Proof (4 pp, first build),
Email drafts, README/LICENSE, notebooks 01-10.
Built but NOT yet visually reviewed: Review-1, Review-3, Final PPTs (website screenshots still being regenerated), Outcome Proof, Plagiarism Report PDF.
Not done: website agent stopped mid-way (code in web/, check `npm run build`, tests, Lighthouse, demo video);
results.json "web" section (test counts, Lighthouse, query time); Source_Code.zip (run docs_build/make_source_zip.py);
Submission Checklist PDF; git init + commit; final regeneration of all documents.
