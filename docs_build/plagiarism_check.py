"""Similarity self-check: n-gram fingerprint overlap + TF-IDF sentence cosine against the source corpus,
plus a cross-document check (report vs paper vs decks). Writes reports/plagiarism/check_results.json.

Similarity % of a document = share of its words that are covered by an 8-word sequence also found in a source
(the usual fingerprinting idea behind tools such as copydetect / MOSS); 5-gram coverage is reported as a stricter view.
The reference list, URLs, numbers-only tokens and the literature-table citation columns are excluded.
"""
from __future__ import annotations

import json
import random
import re
import sys
from collections import defaultdict
from pathlib import Path

import pymupdf
from pptx import Presentation
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

sys.path.insert(0, str(Path(__file__).parent))
from common import LIT, OUT, PREFIX, ROOT  # noqa: E402

PLAG = ROOT / "reports" / "plagiarism"
CORPUS = PLAG / "corpus"
WORD = re.compile(r"[a-z][a-z'\-]+")


def words(t: str) -> list[str]:
    return WORD.findall(t.lower())


def pdf_text(p: Path, stop_at: str | None) -> str:
    t = "\n".join(pg.get_text() for pg in pymupdf.open(p))
    if stop_at:
        idx = t.rfind(stop_at)
        if idx > 0:
            t = t[:idx]
    t = re.sub(r"https?://\S+|doi:\s*\S+", " ", t)
    return t


def pptx_text(p: Path) -> str:
    out = []
    for s in Presentation(str(p)).slides:
        for sh in s.shapes:
            if sh.has_text_frame:
                out.append(sh.text_frame.text)
            if sh.has_table:
                out += [c.text for row in sh.table.rows for c in row.cells]
        if s.has_notes_slide:
            out.append(s.notes_slide.notes_text_frame.text)
    return "\n".join(out)


def grams(ws: list[str], k: int) -> dict[tuple, list[int]]:
    g = defaultdict(list)
    for i in range(len(ws) - k + 1):
        g[tuple(ws[i:i + k])].append(i)
    return g


def coverage(doc_ws: list[str], src: dict[str, list[str]], k: int):
    covered = [False] * len(doc_ws)
    per_src = {}
    dg = grams(doc_ws, k)
    for name, ws in src.items():
        sg = set(tuple(ws[i:i + k]) for i in range(len(ws) - k + 1))
        mark = [False] * len(doc_ws)
        for g, pos in dg.items():
            if g in sg:
                for i in pos:
                    for j in range(i, i + k):
                        mark[j] = True
                        covered[j] = True
        c = sum(mark)
        if c:
            per_src[name] = 100 * c / len(doc_ws)
    return 100 * sum(covered) / max(1, len(doc_ws)), per_src, covered


def passages(doc_ws, covered, min_len=8):
    out, i = [], 0
    while i < len(doc_ws):
        if covered[i]:
            j = i
            while j < len(doc_ws) and covered[j]:
                j += 1
            if j - i >= min_len:
                out.append(" ".join(doc_ws[i:j]))
            i = j
        else:
            i += 1
    return out


def sentences(t: str) -> list[str]:
    t = re.sub(r"\s+", " ", t)
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-Za-z])", t) if len(s.split()) >= 8]


TITLES = sorted({re.sub(r"\s+", " ", p["title"]).lower() for p in LIT()["papers"] + LIT()["software"] if p.get("title")}, key=len, reverse=True)


def drop_titles(t: str) -> str:
    """Titles of cited works are citations, not prose: remove them before matching."""
    low = re.sub(r"\s+", " ", t).lower()
    for ti in TITLES:
        low = low.replace(ti, " ")
    return low


def main(tag: str = "final") -> dict:
    src = {p.stem: words(p.read_text(encoding="utf-8")) for p in CORPUS.glob("*.txt")}
    src = {k: v for k, v in src.items() if len(v) >= 30}
    docs = {
        "Project Report": pdf_text(OUT / f"{PREFIX}_Project_Report.pdf", "7. REFERENCES"),
        "IEEE Paper": pdf_text(OUT / f"{PREFIX}_IEEE_Paper.pdf", "REFERENCES"),
    }
    for nm in ["Review2", "Review3", "Final", "Review1"]:
        p = OUT / f"{PREFIX}_{nm}_PPT.pptx"
        if p.exists():
            docs[f"{nm} PPT"] = pptx_text(p)
    src_sents, src_names = [], []
    for k, v in src.items():
        raw = (CORPUS / f"{k}.txt").read_text(encoding="utf-8")
        for s in sentences(raw):
            src_sents.append(s); src_names.append(k)
    res = {"tag": tag, "corpus_docs": len(src), "corpus_words": sum(map(len, src.values())), "documents": {}}
    if tag != "raw":
        docs = {k: drop_titles(v) for k, v in docs.items()}
    for name, t in docs.items():
        ws = words(t)
        s8, per8, cov8 = coverage(ws, src, 8)
        s5, per5, _ = coverage(ws, src, 5)
        sents = sentences(t)
        vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True).fit(sents + src_sents)
        sim = cosine_similarity(vec.transform(sents), vec.transform(src_sents))
        flagged = []
        for i, row in enumerate(sim):
            j = row.argmax()
            if row[j] >= 0.6:
                flagged.append({"sentence": sents[i], "source": src_names[j], "source_sentence": src_sents[j], "cosine": float(row[j])})
        res["documents"][name] = {
            "words": len(ws), "similarity_8gram_pct": s8, "similarity_5gram_pct": s5,
            "top_sources_8gram": sorted(per8.items(), key=lambda x: -x[1])[:8],
            "top_sources_5gram": sorted(per5.items(), key=lambda x: -x[1])[:8],
            "matched_passages_8gram": passages(ws, cov8)[:30],
            "sentences": len(sents), "tfidf_flagged": sorted(flagged, key=lambda x: -x["cosine"])[:20],
            "max_single_source_8gram_pct": max(per8.values()) if per8 else 0.0,
        }
        print(f"{name}: {len(ws)} words, 8-gram {s8:.2f}%, 5-gram {s5:.2f}%, max source {res['documents'][name]['max_single_source_8gram_pct']:.2f}%, flagged {len(flagged)}")
    rw, pw = words(docs["Project Report"]), words(docs["IEEE Paper"])
    s8, _, cov = coverage(pw, {"report": rw}, 8)
    res["cross_report_vs_paper_8gram_pct"] = s8
    res["cross_report_vs_paper_passages"] = passages(pw, cov, 10)[:20]
    print(f"Paper vs Report (8-gram share of paper words): {s8:.2f}%")
    # random sentence sample for the web check (fixed seed)
    random.seed(42)
    raw_r = pdf_text(OUT / f"{PREFIX}_Project_Report.pdf", "7. REFERENCES")
    raw_p = pdf_text(OUT / f"{PREFIX}_IEEE_Paper.pdf", "REFERENCES")
    rs = [x for x in sentences(raw_r) if 10 <= len(x.split()) <= 45 and "|" not in x]
    ps = [x for x in sentences(raw_p) if 10 <= len(x.split()) <= 45]
    res["web_sample"] = {"report": random.sample(rs, min(60, len(rs))), "paper": random.sample(ps, min(30, len(ps)))}
    PLAG.mkdir(parents=True, exist_ok=True)
    (PLAG / f"check_results_{tag}.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    return res


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "final")
