"""Clean source snapshot: no raw/processed data, no virtual envs, no node_modules, no tools, no secrets."""
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import OUT, PREFIX, ROOT  # noqa: E402

EXCLUDE_DIRS = {".venv", ".venv-profiling", "node_modules", "tools", "__pycache__", ".ipynb_checkpoints", "test-results",
                "playwright-report", ".git", "corpus", "paper_tex", "dist", "deliverables", ".pytest_cache", "lighthouse-tmp"}
EXCLUDE_PATHS = {"data/raw", "data/interim", "data/processed", "web/public/data", "web/demo"}
SECRET = re.compile(r"(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}", re.I)
MAX_BYTES = 15_000_000

out = OUT / f"{PREFIX}_Source_Code.zip"
n, flagged = 0, []
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(ROOT.rglob("*")):
        rel = p.relative_to(ROOT).as_posix()
        if p.is_dir() or any(part in EXCLUDE_DIRS for part in p.relative_to(ROOT).parts):
            continue
        if any(rel == e or rel.startswith(e + "/") for e in EXCLUDE_PATHS):
            continue
        if p.name in {"kaggle.json", ".env"} or p.stat().st_size > MAX_BYTES:
            continue
        if p.suffix in {".py", ".js", ".ts", ".tsx", ".json", ".md", ".yml", ".yaml", ".txt", ".toml"}:
            try:
                if SECRET.search(p.read_text(encoding="utf-8", errors="ignore")):
                    flagged.append(rel)
                    continue
            except OSError:
                pass
        z.write(p, f"{PREFIX}_SonicAtlas/{rel}")
        n += 1
    z.writestr(f"{PREFIX}_SonicAtlas/DATA_NOT_INCLUDED.txt",
               "Raw and processed data are not included (size and licence). Run `python docs_build/download_data.py` and the "
               "notebooks (see README) to rebuild them. Website data files are produced by `python -m sonicatlas.web_export`.\n")
print(f"{out.name}: {n} files, {out.stat().st_size / 1e6:.1f} MB; secret-pattern hits skipped: {flagged}")
