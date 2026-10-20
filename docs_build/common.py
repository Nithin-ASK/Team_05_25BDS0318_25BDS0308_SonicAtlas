"""Shared facts and number formatting for every generated document."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIG = ROOT / "reports" / "figures"
OUT = ROOT / "deliverables"
PREFIX = "Team_05_25BDS0318_25BDS0308"

TITLE = ("SonicAtlas: An Interactive In-Browser Exploratory Data Analysis Platform for Multi-Dimensional "
         "Audio Features and Lyrics of Spotify Tracks Across Genres and Eras")
SHORT_TITLE = "SonicAtlas: In-Browser EDA of Spotify Audio Features and Lyrics"
TEAM = [("25BDS0318", "Sharvesh Prabhu", "<email>"), ("25BDS0308", "Nithin S", "nithin.s2025a@vitstudent.ac.in")]
COURSE_CODE = "BACSE301"
COURSE = "EXPLORATORY DATA ANALYSIS"
SCHOOL = "SCHOOL OF COMPUTER SCIENCE AND ENGINEERING"
UNIV = "VELLORE INSTITUTE OF TECHNOLOGY, VELLORE"
MONTH = "October 2026"
GITHUB = "[GitHub Link]"
LIVE = "[Live Website Link]"
VIDEO = "[Demo Video Link]"


def R() -> dict:
    return json.loads((ROOT / "reports" / "results.json").read_text(encoding="utf-8"))


def LIT() -> dict:
    p = ROOT / "docs_build" / "literature.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"papers": [], "software": [], "venues": []}


def links() -> dict:
    p = ROOT / "docs_build" / "links.json"
    d = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    return {"github": d.get("github", GITHUB), "live": d.get("live", LIVE), "video": d.get("video", VIDEO)}


def n(x, d=0) -> str:
    """Thousands separator with d decimals."""
    return f"{x:,.{d}f}"


def f(x, d=3) -> str:
    return f"{x:.{d}f}"


def pct(x, d=1) -> str:
    return f"{x:.{d}f}%"


def pval(p) -> str:
    if p is None or p < 0.001:
        return "p < 0.001"
    return f"p = {p:.3f}"
