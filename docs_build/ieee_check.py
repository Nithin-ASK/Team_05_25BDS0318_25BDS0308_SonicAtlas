"""IEEE format compliance check of the paper PDF (pdffonts-style font audit with PyMuPDF plus layout checks).

Writes reports/ieee_compliance.json. Note: the official IEEE PDF eXpress check needs a conference ID and is done by
the team after choosing a venue.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).parent))
from common import OUT, PREFIX, ROOT  # noqa: E402

PDF = OUT / f"{PREFIX}_IEEE_Paper.pdf"


def main() -> dict:
    d = pymupdf.open(PDF)
    fonts = {}
    for pg in d:
        for xref, ext, ftype, base, name, enc, *_ in pg.get_fonts(full=True):
            fonts[base] = {"type": ftype, "embedded": ext not in ("", "n/a"), "subset": "+" in base}
    w, h = d[0].rect.width, d[0].rect.height
    # text extent and column detection on body pages
    lefts, rights, tops, bottoms, two_col_pages = [], [], [], [], 0
    for pg in d:
        blocks = [b for b in pg.get_text("blocks") if b[6] == 0 and len(b[4].strip()) > 40]
        if not blocks:
            continue
        lefts.append(min(b[0] for b in blocks)); rights.append(max(b[2] for b in blocks))
        tops.append(min(b[1] for b in blocks)); bottoms.append(max(b[3] for b in blocks))
        mid = w / 2
        left_col = [b for b in blocks if b[2] < mid + 5]
        right_col = [b for b in blocks if b[0] > mid - 5]
        if left_col and right_col:
            two_col_pages += 1
    # page numbers / headers: digits alone near bottom or top edge
    numbered = 0
    for pg in d:
        for b in pg.get_text("blocks"):
            if (b[1] > h - 45 or b[3] < 45) and re.fullmatch(r"\s*\d+\s*", b[4]):
                numbered += 1
    # image resolution
    dpis = []
    for pg in d:
        for img in pg.get_images(full=True):
            xref = img[0]
            px_w = img[2]
            for r in pg.get_image_rects(xref):
                if r.width > 0:
                    dpis.append(px_w / (r.width / 72))
    txt = "\n".join(pg.get_text() for pg in d)
    cites = set(int(x) for grp in re.findall(r"\[(\d+(?:\]\s*,\s*\[\d+)*)\]", txt.split("REFERENCES")[0]) for x in re.findall(r"\d+", grp))
    refs = re.findall(r"^\[(\d+)\]", txt.split("REFERENCES")[-1], re.M)
    res = {
        "pdf": PDF.name, "pages": d.page_count, "page_size_pt": [round(w, 1), round(h, 1)],
        "page_size_ok_A4": abs(w - 595.3) < 2 and abs(h - 841.9) < 2,
        "fonts": fonts, "all_fonts_embedded": all(v["embedded"] for v in fonts.values()),
        "type3_fonts": [k for k, v in fonts.items() if v["type"] == "Type3"],
        "two_column_pages": two_col_pages,
        "text_margin_pt": {"left": round(min(lefts), 1), "right": round(w - max(rights), 1), "top": round(min(tops), 1), "bottom": round(h - max(bottoms), 1)},
        "page_numbers_or_headers_found": numbered,
        "image_dpi_min": round(min(dpis), 0) if dpis else None, "images": len(dpis),
        "citations_in_text": len(cites), "references_listed": len(set(refs)),
        "all_citations_have_reference": cites <= set(int(x) for x in refs),
        "pages_within_6_8": 6 <= d.page_count <= 8,
    }
    (ROOT / "reports" / "ieee_compliance.json").write_text(json.dumps(res, indent=1))
    print(json.dumps({k: v for k, v in res.items() if k != "fonts"}, indent=1))
    print(len(fonts), "fonts")
    return res


if __name__ == "__main__":
    main()
