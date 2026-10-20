"""Single store for every number used by the documents (reports/results.json)."""
from __future__ import annotations

import json
from typing import Any

import numpy as np

from . import ROOT

PATH = ROOT / "reports" / "results.json"


def _py(o: Any) -> Any:
    if isinstance(o, dict):
        return {str(k): _py(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_py(v) for v in o]
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return None if np.isnan(o) else float(o)
    if isinstance(o, float) and np.isnan(o):
        return None
    if isinstance(o, np.bool_):
        return bool(o)
    return o


def load() -> dict:
    return json.loads(PATH.read_text(encoding="utf-8")) if PATH.exists() else {}


def save(section: str, data: dict) -> None:
    """Merge ``data`` into ``results[section]`` and write the file."""
    r = load()
    r.setdefault(section, {}).update(_py(data))
    PATH.write_text(json.dumps(r, indent=2), encoding="utf-8")
