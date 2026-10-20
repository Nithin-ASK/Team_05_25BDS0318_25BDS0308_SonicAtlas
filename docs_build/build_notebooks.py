"""Turn notebooks/src/*.py (cells split by '# %%') into .ipynb and execute them.

Usage: python docs_build/build_notebooks.py [prefix ...]
A '# %% [markdown]' cell holds markdown written as '# ' comment lines.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import nbformat
from nbconvert.preprocessors import ExecutePreprocessor

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "notebooks" / "src"
OUT = ROOT / "notebooks"


def parse(path: Path) -> nbformat.NotebookNode:
    nb = nbformat.v4.new_notebook()
    nb.metadata["kernelspec"] = {"name": "python3", "display_name": "Python 3", "language": "python"}
    blocks: list[tuple[str, list[str]]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# kernel:"):
            continue
        if line.startswith("# %%"):
            blocks.append(("markdown" if "[markdown]" in line else "code", []))
        elif blocks:
            blocks[-1][1].append(line)
    for kind, lines in blocks:
        text = "\n".join(lines).strip("\n")
        if not text:
            continue
        if kind == "markdown":
            md = "\n".join(l[2:] if l.startswith("# ") else l.lstrip("#") for l in lines).strip()
            nb.cells.append(nbformat.v4.new_markdown_cell(md))
        else:
            nb.cells.append(nbformat.v4.new_code_cell(text))
    return nb


def main(prefixes: list[str]) -> None:
    log = []
    for src in sorted(SRC.glob("*.py")):
        if prefixes and not any(src.name.startswith(p) for p in prefixes):
            continue
        nb = parse(src)
        first = src.read_text(encoding="utf-8").splitlines()[0]
        kernel = first.split(":", 1)[1].strip() if first.startswith("# kernel:") else "python3"
        nb.metadata["kernelspec"]["name"] = kernel
        t0 = time.time()
        ep = ExecutePreprocessor(timeout=3600, kernel_name=kernel)
        ep.preprocess(nb, {"metadata": {"path": str(OUT)}})
        dest = OUT / (src.stem + ".ipynb")
        nbformat.write(nb, dest)
        msg = f"{dest.name}: OK in {time.time() - t0:.1f}s ({len(nb.cells)} cells)"
        print(msg, flush=True)
        log.append(msg)
    with open(OUT / "run_log.txt", "a", encoding="utf-8") as f:
        f.write(time.strftime("%Y-%m-%d %H:%M") + "\n" + "\n".join(log) + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
