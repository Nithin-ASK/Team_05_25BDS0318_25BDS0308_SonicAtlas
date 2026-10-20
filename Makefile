# SonicAtlas - Team 05 (BACSE301). Run from the project root.
PY      ?= .venv/Scripts/python
PYPROF  ?= .venv-profiling/Scripts/python
NB      = $(PY) docs_build/build_notebooks.py

.PHONY: all data eda profile web report ppt paper proof plagcheck test zip clean-figs

all: data eda profile web report ppt paper proof plagcheck zip

data:            ## download raw data (public Kaggle endpoint) and audit/clean it
	$(PY) docs_build/download_data.py
	$(NB) 01 02

eda:             ## run every analysis notebook (except profiling) top to bottom
	$(NB) 03 04 05 06 07 08 10
	$(PY) docs_build/make_diagrams.py
	$(PY) -m sonicatlas.web_export

profile:         ## automated EDA tools in their own environment
	$(PYPROF) -m ipykernel install --user --name sonic-profiling
	$(NB) 09

web:             ## build the static website
	cd web && npm ci && npm run build

test:
	$(PY) -m pytest -q
	cd web && npm test && npx playwright test

report:
	$(PY) docs_build/build_report.py

ppt:
	cd docs_build && node build_review2.js && node build_review3.js && node build_final.js && node build_review1.js
	$(PY) docs_build/export_decks.py

paper:
	$(PY) docs_build/build_paper.py

proof:
	$(PY) docs_build/build_outcome_proof.py

plagcheck:
	$(PY) docs_build/plagiarism_check.py

zip:
	$(PY) docs_build/make_source_zip.py
