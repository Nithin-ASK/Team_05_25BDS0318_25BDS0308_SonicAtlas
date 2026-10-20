"""Export every deck in deliverables/ to PDF with PowerPoint (COM)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import OUT, PREFIX  # noqa: E402
from docx_helpers import pptx_to_pdf  # noqa: E402

names = sys.argv[1:] or ["Review1", "Review2", "Review3", "Final"]
for nm in names:
    p = OUT / f"{PREFIX}_{nm}_PPT.pptx"
    if p.exists():
        pptx_to_pdf(p, p.with_suffix(".pdf"))
        print("pdf:", p.with_suffix(".pdf").name)
