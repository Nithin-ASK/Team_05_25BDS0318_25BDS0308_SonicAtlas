"""Shared matplotlib theme: colour-blind-safe (Okabe-Ito), print-safe markers."""
from __future__ import annotations

from pathlib import Path

import matplotlib as mpl
import matplotlib.pyplot as plt

from . import FIG

OKABE_ITO = ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7",
             "#56B4E9", "#F0E442", "#000000"]
MARKERS = ["o", "s", "^", "D", "v", "P", "X", "*"]
LINESTYLES = ["-", "--", "-.", ":", (0, (5, 1)), (0, (3, 1, 1, 1)), "-", "--"]
SOURCE = "Source: Spotify 1.2M+ Songs & Spotify Tracks (Kaggle); SonicAtlas analysis"


def apply() -> None:
    mpl.rcParams.update({
        "figure.dpi": 110, "savefig.dpi": 300, "font.family": "DejaVu Sans",
        "font.size": 10, "axes.titlesize": 12, "axes.titleweight": "bold",
        "axes.labelsize": 10, "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.alpha": 0.3, "legend.frameon": False,
        "axes.prop_cycle": mpl.cycler(color=OKABE_ITO),
    })


def save(fig: plt.Figure, name: str, source: str = SOURCE) -> Path:
    """Add a source note and save PNG (300 dpi) + SVG under reports/figures."""
    fig.text(0.99, -0.01, source, ha="right", va="top", fontsize=7, color="#555")
    FIG.mkdir(parents=True, exist_ok=True)
    png = FIG / f"{name}.png"
    fig.savefig(png, bbox_inches="tight")
    fig.savefig(FIG / f"{name}.svg", bbox_inches="tight")
    plt.close(fig)
    return png
