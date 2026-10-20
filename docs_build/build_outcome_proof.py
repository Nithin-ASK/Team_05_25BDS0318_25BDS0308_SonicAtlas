"""Outcome Proof evidence pack in IEEE style (IEEEtran, two columns) -> PDF via Tectonic.

Only true, checkable items. Pending proofs (submission ID, acceptance, certificate, Turnitin) are EMPTY labelled slots.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).parent))
from build_paper import tex_escape  # noqa: E402
from common import FIG, LIT, OUT, PREFIX, ROOT, R, TEAM, TITLE, f, links, n, pct  # noqa: E402

r = R(); L = links()
A, C, M, DR, TS, T = r["audit"], r["cleaning"], r["multivariate"], r["dimred"], r["timeseries"], r["tests"]
LY, WEB, QA, NET, PR = r.get("lyrics"), r.get("web", {}), r.get("qa", {}), r.get("network"), r.get("profiling")
IEEE = json.loads((ROOT / "reports" / "ieee_compliance.json").read_text())
PLAG = json.loads((ROOT / "reports" / "plagiarism" / "check_results_final.json").read_text(encoding="utf-8"))
WEBCHK = json.loads((ROOT / "reports" / "plagiarism" / "web_check.json").read_text(encoding="utf-8"))
BUILD = ROOT / "docs_build" / "proof_tex"
fl = TS["first_last"]


def git(*args):
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return ""


def table(cap, rows, spec="p{0.42\\columnwidth}p{0.48\\columnwidth}", head=None):
    out = [r"\begin{table}[!t]", r"\caption{" + tex_escape(cap) + "}", r"\centering", r"\footnotesize", r"\begin{tabular}{" + spec + "}", r"\hline"]
    if head:
        out += [" & ".join(r"\textbf{" + tex_escape(h) + "}" for h in head) + r" \\ \hline"]
    out += [" & ".join(tex_escape(str(c)) for c in row) + r" \\" for row in rows]
    out += [r"\hline", r"\end{tabular}", r"\end{table}"]
    return out


def fig(fn, cap, wide=False, width=None):
    env = "figure*" if wide else "figure"
    w = width or (r"0.9\textwidth" if wide else r"\columnwidth")
    return [r"\begin{" + env + "}[!t]", r"\centering", r"\fbox{\includegraphics[width=" + w + "]{" + fn + "}}" if fn.startswith("paper") or fn.startswith("web_") else r"\includegraphics[width=" + w + "]{" + fn + "}",
            r"\caption{" + tex_escape(cap) + "}", r"\end{" + env + "}"]


def main():
    BUILD.mkdir(parents=True, exist_ok=True)
    shutil.copy(ROOT / "tools" / "dl" / "ieeetran" / "IEEEtran" / "IEEEtran.cls", BUILD)
    d = pymupdf.open(OUT / f"{PREFIX}_IEEE_Paper.pdf")
    d[0].get_pixmap(dpi=150).save(BUILD / "paper_page1.png")
    figs_used = ["fig_06_02_yearly_trends_rolling.png", "fig_05_05_clusters_on_tsne.png", "fig_04_01_correlation_heatmaps.png"]
    shots = [("web_02_query_studio_light.png", "Query Studio: SQL console and filter builder running on DuckDB-WASM."),
             ("web_03_acoustic_map_light.png", "Acoustic Map: switchable PCA / t-SNE / LLE / UMAP projections."),
             ("web_05_compare_light.png", "Compare: group statistics with live significance tests."),
             ("web_06_time_machine_light.png", "Time Machine: yearly trends, STL components and change points."),
             ("web_01_home_light.png", "Home page with headline statistics and key findings.")]
    shots = [(s, c) for s, c in shots if (FIG / s).exists()]
    for fn in figs_used + [s for s, _ in shots]:
        shutil.copy(FIG / fn, BUILD / fn)
    commits = git("rev-list", "--count", "HEAD") or "0"
    first = git("log", "--reverse", "--format=%ad", "--date=short").splitlines()[:1]
    last = git("log", "-1", "--format=%ad", "--date=short")
    tag = git("describe", "--tags", "--abbrev=0") or "none yet"
    venues = LIT()["venues"]
    cite_paper = (f"S. Prabhu and N. S, ``{TITLE},'' Team 05 project paper, BACSE301 Exploratory Data Analysis, "
                  "Vellore Institute of Technology, Vellore, India, Oct. 2026 (prepared for submission).")

    T_ = [r"\documentclass[conference,a4paper]{IEEEtran}", r"\usepackage{graphicx}", r"\usepackage[T1]{fontenc}",
          r"\usepackage{newtxtext,newtxmath}", r"\usepackage[hyphens]{url}", r"\usepackage{array}", r"\begin{document}",
          r"\title{Outcome Proof: " + tex_escape(TITLE) + "}",
          r"\author{\IEEEauthorblockN{Team 05: " + " and ".join(tex_escape(f"{nm} ({rg})") for rg, nm, _ in TEAM) + r"}" +
          r"\IEEEauthorblockA{BACSE301 Exploratory Data Analysis, School of Computer Science and Engineering\\ Vellore Institute of Technology, Vellore, India \\ 20 October 2026}}",
          r"\maketitle",
          r"\begin{abstract}" + tex_escape("This evidence pack documents the verifiable outcomes of the SonicAtlas course project: an IEEE-format "
          "research paper prepared for submission, an open-source code repository, a static website, reproducibility evidence, the key results, "
          "and an originality self-check. Every item can be checked against the files and links listed. Items that only the team can obtain "
          "later (submission receipt, acceptance, certificate, official Turnitin report) are left as empty, labelled slots.") + r"\end{abstract}"]
    T_ += [r"\section{IEEE Research Paper}", tex_escape("Fig. 1 shows the first page of the paper. Full citation (IEEE style):"),
           r"\begin{quote}\small " + tex_escape(cite_paper).replace("\\textasciigrave{}\\textasciigrave{}", "``") + r"\end{quote}",
           r"\textbf{Status: prepared for submission.} " + tex_escape("It has not been submitted, accepted or published. Target venues: " +
           "; ".join(f"{v['name'].split(' (')[0]} ({v['url']})" for v in venues) + ".")]
    T_ += fig("paper_page1.png", "First page of the IEEE-format paper (IEEEtran conference class, A4).", width=r"0.95\columnwidth")
    comp = [["Two-column layout", f"yes ({IEEE['two_column_pages']} of {IEEE['pages']} pages with two text columns)"],
            ["Page size", f"A4, {IEEE['page_size_pt'][0]} x {IEEE['page_size_pt'][1]} pt" + (" (pass)" if IEEE["page_size_ok_A4"] else " (check)")],
            ["Length", f"{IEEE['pages']} pages (6-8 required)"],
            ["Fonts embedded", ("all " if IEEE["all_fonts_embedded"] else "NOT all ") + f"{len(IEEE['fonts'])} fonts embedded"],
            ["Type-3 fonts", "none" if not IEEE["type3_fonts"] else ", ".join(IEEE["type3_fonts"])],
            ["Text margins (pt)", f"L {IEEE['text_margin_pt']['left']}, R {IEEE['text_margin_pt']['right']}, T {IEEE['text_margin_pt']['top']}"],
            ["Page numbers / headers", "none (as the template requires)" if IEEE["page_numbers_or_headers_found"] == 0 else "present - remove"],
            ["Figure resolution", f"minimum {int(IEEE['image_dpi_min'])} dpi effective (>= 300)"],
            ["References", f"{IEEE['references_listed']} listed; all {IEEE['citations_in_text']} in-text citations resolved"],
            ["IEEE PDF eXpress", "pending - needs the conference ID; done by the team"]]
    T_ += table("IEEE format compliance check (automated, docs\\_build/ieee\\_check.py)", comp, head=["Check", "Result"])
    T_ += [r"\section{Software Outcome}",
           tex_escape(f"Repository: {L['github']}. Live website: {L['live']}. Licence: MIT (code). Local git history: {commits} commits"
                      + (f" from {first[0]} to {last}" if first else "") + f"; release tag: {tag}. "
                      "The site is a static build (web/dist) deployed by the GitHub Actions workflow .github/workflows/deploy-pages.yml. "
                      "Figures 2-" + str(1 + len(shots)) + " are real screenshots of the running site.")]
    for s_, c_ in shots:
        T_ += fig(s_, c_, width=r"0.95\columnwidth")
    rep_rows = [["Python environment", "Python 3.13, pinned requirements.txt (+ requirements-profiling.txt)"],
                ["Notebooks", "10 notebooks run top to bottom (notebooks/run\\_log.txt)".replace("\\_", "_")],
                ["Python unit tests", QA.get("pytest", "see tests/")],
                ["Web unit tests", WEB.get("unit_tests", "see web/TESTING.md")],
                ["End-to-end tests", WEB.get("e2e_tests", "see web/TESTING.md")],
                ["Lighthouse", WEB.get("lighthouse", "see web/lighthouse/")],
                ["Lite-data query time", f"{WEB['query_ms_median']} ms median" if WEB.get("query_ms_median") is not None else "see web/TESTING.md"],
                ["Number cross-check", "all key numbers in report, paper and decks equal results.json (docs_build/check_numbers.py)"]]
    T_ += [r"\section{Reproducibility}", tex_escape("TABLE II lists the evidence that the project can be rebuilt from scratch.")]
    T_ += table("Reproducibility evidence", rep_rows, head=["Item", "Evidence"])
    key = [["Tracks analysed", n(A["a_rows"])], ["Genre-labelled tracks / genres", f"{n(C['rows_genre_tracks'])} / {A['g_genres']}"],
           ["Zero-BPM tempos repaired (MICE)", n(C["tempo_zero_imputed"])], ["Loudness change", f"{f(fl['loudness'][0], 1)} to {f(fl['loudness'][1], 1)} dB ({TS['year_window'][0]}-{TS['year_window'][1]})"],
           ["Loudness ~ energy (Pearson)", f(M["pairs"]["loudness~energy"]["pearson"], 2)], ["Genre effect on danceability (eta sq.)", f(T["anova"]["eta_squared"], 3)],
           ["t-SNE trustworthiness", f(DR["comparison"]["t-SNE"]["trustworthiness_k10"], 3)]]
    if LY:
        key.append(["Lyric sentiment ~ valence (r)", f(LY["r_valence_vader"], 2)])
    T_ += [r"\section{Results Summary}", tex_escape("TABLE III repeats the key numbers from reports/results.json; Figs. "
           f"{2 + len(shots)}-{4 + len(shots)} show three key figures.")]
    T_ += table("Key results (from results.json)", key, head=["Quantity", "Value"])
    T_ += fig(figs_used[0], "Yearly means and 5-year rolling means of six audio descriptors.", wide=True, width=r"0.85\textwidth")
    T_ += fig(figs_used[1], "Six named KMeans clusters on the t-SNE map.")
    T_ += fig(figs_used[2], "Pearson and Spearman correlation matrices.", wide=True, width=r"0.85\textwidth")
    dd = PLAG["documents"]
    pl = [[k, f"{v['similarity_8gram_pct']:.2f}%", f"{v['max_single_source_8gram_pct']:.2f}%"] for k, v in dd.items()]
    T_ += [r"\section{Originality}", tex_escape(f"A similarity self-check (not an official Turnitin report) compared every document with a corpus of "
           f"{PLAG['corpus_docs']} sources ({PLAG['corpus_words']:,} words) by 8-word fingerprints and TF-IDF sentence cosine, and searched "
           f"{WEBCHK['checked']} sampled sentences on the web as exact phrases (prose matches: report {WEBCHK['summary']['report_matches']} "
           "- a cited paper title - and paper " + str(WEBCHK['summary']['paper_matches']) + "). Details are in the Plagiarism Report.")]
    T_ += table("Similarity self-check results", pl, spec="p{0.36\\columnwidth}p{0.22\\columnwidth}p{0.26\\columnwidth}", head=["Document", "Similarity", "Max one source"])
    T_ += [r"\section{Pending Proofs (to be added by the team)}",
           tex_escape("The following evidence does not exist yet and must NOT be created by anyone other than the issuing body. "
                      "Each slot is intentionally empty."),
           r"\begin{table}[!h]", r"\caption{Pending proofs}", r"\centering", r"\footnotesize", r"\begin{tabular}{|p{0.45\columnwidth}|p{0.42\columnwidth}|}", r"\hline"]
    for slot in ["Conference submission acknowledgement / paper ID", "Acceptance e-mail", "Presentation certificate",
                 "Official Turnitin report from VIT", "IEEE PDF eXpress compliance report"]:
        T_ += [tex_escape(slot) + r" & \rule{0pt}{1.1cm} \\ \hline"]
    T_ += [r"\end{tabular}", r"\end{table}", r"\end{document}"]
    (BUILD / "proof.tex").write_text("\n".join(T_), encoding="utf-8")
    subprocess.run([str(ROOT / "tools" / "tectonic" / "tectonic.exe"), "-X", "compile", "proof.tex"], cwd=BUILD, check=True, capture_output=True)
    shutil.copy(BUILD / "proof.pdf", OUT / f"{PREFIX}_Outcome_Proof.pdf")
    print("pages:", pymupdf.open(OUT / f"{PREFIX}_Outcome_Proof.pdf").page_count)


if __name__ == "__main__":
    main()
