"""Quality gate: every key number from results.json must appear, formatted identically, in each document.

For each document (PDF text) we check a list of formatted key facts. A fact is only required in the documents that
are expected to mention it. Output: reports/number_check.json and a printed summary; exit code 1 on any miss.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).parent))
from common import OUT, PREFIX, ROOT, R, f, n, pct  # noqa: E402

r = R()
A, C, D, M, DR, TS, T = (r["audit"], r["cleaning"], r["descriptive"], r["multivariate"], r["dimred"], r["timeseries"], r["tests"])
fl = TS["first_last"]

# fact -> documents that must contain it (R = report, P = paper, 2/3/F = decks, O = outcome proof)
FACTS = {
    n(A["a_rows"]): "RP23FO",
    n(C["tempo_zero_imputed"]): "RP2",
    n(C["reissue_rows"]): "RP2",
    n(C["iso_outliers"]): "RP2",
    pct(C["join"]["match_rate_pct"]): "RP2",
    f(M["pairs"]["loudness~energy"]["pearson"], 2): "RP2F",
    f(M["pairs"]["energy~acousticness"]["pearson"], 2): "RP2F",
    f(DR["comparison"]["t-SNE"]["trustworthiness_k10"], 3): "RP2",
    f(DR["comparison"]["LLE"]["trustworthiness_k10"], 3): "RP2",
    f(T["anova"]["eta_squared"], 3): "RP",
    f(T["anova"]["F"], 1): "RP",
    f(T["chi2_mode_genre"]["cramers_v"], 3): "RP",
    f(fl["loudness"][0], 1): "RP",
    f(fl["loudness"][1], 1): "RP",
    f(fl["acousticness"][0], 2): "RP",
    f(fl["acousticness"][1], 2): "RP",
    f(D["all"]["speechiness"]["g1"], 2): "RP2",
    f(TS["arima"]["mae"], 2): "RP",
    str(DR["n90"]): "RP2",
}
if "lyrics" in r:
    FACTS[n(r["lyrics"]["rows_used"])] = "RP"
    FACTS[f(r["lyrics"]["r_valence_vader"], 2)] = "RP"

DOCS = {"R": f"{PREFIX}_Project_Report.pdf", "P": f"{PREFIX}_IEEE_Paper.pdf", "2": f"{PREFIX}_Review2_PPT.pdf",
        "3": f"{PREFIX}_Review3_PPT.pdf", "F": f"{PREFIX}_Final_PPT.pdf", "O": f"{PREFIX}_Outcome_Proof.pdf"}


def text(p: Path) -> str:
    t = " ".join(pg.get_text() for pg in pymupdf.open(p))
    return re.sub(r"\s+", " ", t.replace("−", "-"))


def main() -> int:
    report, missing = {}, 0
    for code, name in DOCS.items():
        p = OUT / name
        if not p.exists():
            continue
        t = text(p)
        need = [k for k, docs in FACTS.items() if code in docs]
        miss = [k for k in need if k not in t]
        report[name] = {"checked": len(need), "missing": miss}
        missing += len(miss)
        print(f"{name}: {len(need) - len(miss)}/{len(need)} facts found" + (f"  MISSING {miss}" if miss else ""))
    (ROOT / "reports" / "number_check.json").write_text(json.dumps(report, indent=1))
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
