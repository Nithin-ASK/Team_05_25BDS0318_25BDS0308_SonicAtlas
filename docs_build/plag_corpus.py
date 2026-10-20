"""Build the comparison corpus for the similarity self-check (reports/plagiarism/corpus/*.txt).

Sources: abstracts of every cited paper (Crossref, then OpenAlex, then arXiv), Kaggle dataset descriptions (public API),
and Wikipedia articles on the main topics (REST API, plain text extracts).
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
from common import LIT, ROOT  # noqa: E402

OUTD = ROOT / "reports" / "plagiarism" / "corpus"
OUTD.mkdir(parents=True, exist_ok=True)
H = {"User-Agent": "SonicAtlas-student-project/1.0 (mailto:nithin.s2025a@vitstudent.ac.in)"}


def strip(t: str) -> str:
    return re.sub(r"<[^>]+>", " ", t or "").strip()


def openalex_abs(inv: dict) -> str:
    pos = {p: w for w, ps in inv.items() for p in ps}
    return " ".join(pos[i] for i in sorted(pos))


def paper_text(p: dict) -> str:
    txt = ""
    if p.get("doi"):
        try:
            j = requests.get(f"https://api.crossref.org/works/{p['doi']}", headers=H, timeout=30).json()["message"]
            txt = strip(j.get("abstract", ""))
        except Exception:
            pass
        if not txt:
            try:
                j = requests.get(f"https://api.openalex.org/works/doi:{p['doi']}", headers=H, timeout=30).json()
                if j.get("abstract_inverted_index"):
                    txt = openalex_abs(j["abstract_inverted_index"])
            except Exception:
                pass
    if not txt and "arxiv.org/abs/" in (p.get("url") or ""):
        aid = p["url"].split("/abs/")[1]
        x = requests.get(f"http://export.arxiv.org/api/query?id_list={aid}", headers=H, timeout=30).text
        m = re.search(r"<summary>(.*?)</summary>", x, re.S)
        txt = m.group(1).strip() if m else ""
    if not txt:
        try:
            j = requests.get("https://api.openalex.org/works", params={"search": p["title"], "per-page": 1}, headers=H, timeout=30).json()
            if j["results"] and j["results"][0].get("abstract_inverted_index"):
                txt = openalex_abs(j["results"][0]["abstract_inverted_index"])
        except Exception:
            pass
    return f"{p['title']}. {txt}"


WIKI = ["Exploratory_data_analysis", "Principal_component_analysis", "T-distributed_stochastic_neighbor_embedding",
        "Nonlinear_dimensionality_reduction", "Singular_value_decomposition", "Spotify", "Loudness_war", "Imputation_(statistics)",
        "Isolation_forest", "Andrews_plot", "Parallel_coordinates", "Sentiment_analysis", "DuckDB", "WebAssembly",
        "Kruskal–Wallis_test", "One-way_analysis_of_variance", "Chi-squared_test", "Skewness", "Kurtosis", "Interquartile_range",
        "Decomposition_of_time_series", "Change_detection", "K-means_clustering", "Music_information_retrieval", "Music_genre",
        "Feature_selection", "Pearson_correlation_coefficient", "Uniform_manifold_approximation_and_projection",
        "Louvain_method", "Type–token_ratio", "Box_plot", "Outlier", "Autoregressive_integrated_moving_average"]
KAGGLE = ["rodolfofigueroa/spotify-12m-songs", "maharshipandya/-spotify-tracks-dataset",
          "carlosgdcj/genius-song-lyrics-with-language-information"]


def main() -> None:
    meta = {}
    L = LIT()
    for p in L["papers"]:
        t = paper_text(p)
        (OUTD / f"paper_{p['id']}.txt").write_text(t, encoding="utf-8")
        meta[p["id"]] = len(t.split())
        time.sleep(0.3)
    for slug in KAGGLE:
        try:
            j = requests.get(f"https://www.kaggle.com/api/v1/datasets/view/{slug}", headers=H, timeout=30).json()
            t = f"{j.get('title', '')}. {j.get('subtitle', '')}. {strip(j.get('description', ''))}"
        except Exception:
            t = ""
        name = "kaggle_" + slug.split("/")[1].strip("-")
        (OUTD / f"{name}.txt").write_text(t, encoding="utf-8")
        meta[name] = len(t.split())
    for w in WIKI:
        try:
            j = requests.get("https://en.wikipedia.org/w/api.php", params={"action": "query", "prop": "extracts", "explaintext": 1,
                             "titles": w.replace("_", " "), "format": "json", "redirects": 1}, headers=H, timeout=30).json()
            t = next(iter(j["query"]["pages"].values())).get("extract", "")
        except Exception:
            t = ""
        (OUTD / f"wiki_{re.sub(r'[^A-Za-z0-9]+', '_', w)}.txt").write_text(t, encoding="utf-8")
        meta["wiki_" + w] = len(t.split())
        time.sleep(0.2)
    (OUTD.parent / "corpus_manifest.json").write_text(json.dumps(meta, indent=1))
    print(len(meta), "documents,", sum(meta.values()), "words; empty:", [k for k, v in meta.items() if v < 30])


if __name__ == "__main__":
    main()
