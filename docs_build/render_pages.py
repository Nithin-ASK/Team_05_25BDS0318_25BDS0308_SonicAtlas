"""Render every PDF page to PNG and build contact sheets for visual QA.

Usage: python docs_build/render_pages.py file.pdf out_dir [per_sheet] [dpi]
"""
import sys
from pathlib import Path

import pymupdf
from PIL import Image

pdf, out = Path(sys.argv[1]), Path(sys.argv[2])
per = int(sys.argv[3]) if len(sys.argv) > 3 else 6
dpi = int(sys.argv[4]) if len(sys.argv) > 4 else 60
out.mkdir(parents=True, exist_ok=True)
for old in out.glob("*.png"):
    old.unlink()
doc = pymupdf.open(pdf)
pages = []
for i, pg in enumerate(doc):
    p = out / f"page_{i + 1:02d}.png"
    pg.get_pixmap(dpi=dpi).save(p)
    pages.append(p)
cols = 3 if per >= 6 else per
for s in range(0, len(pages), per):
    ims = [Image.open(p) for p in pages[s:s + per]]
    w, h = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols - 1) * 10, rows * h + (rows - 1) * 10), "#888")
    for k, im in enumerate(ims):
        sheet.paste(im, ((k % cols) * (w + 10), (k // cols) * (h + 10)))
    sheet.save(out / f"sheet_{s // per + 1:02d}.png")
print(len(pages), "pages ->", out)
