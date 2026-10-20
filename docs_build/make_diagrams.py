"""Draw the system architecture and methodology flow diagrams (matplotlib, print-safe)."""
from __future__ import annotations

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

from sonicatlas import theme

theme.apply()
plt.rcParams["axes.grid"] = False


def box(ax, x, y, w, h, title, body, fc):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.08", fc=fc, ec="black", lw=1.2))
    ax.text(x + w / 2, y + h - 0.18, title, ha="center", va="top", fontsize=10.5, fontweight="bold")
    ax.text(x + w / 2, y + h - 0.52, body, ha="center", va="top", fontsize=8.3, linespacing=1.35)


def arrow(ax, x0, y0, x1, y1, label=""):
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0), arrowprops=dict(arrowstyle="-|>", lw=1.4, color="black"))
    if label:
        ax.text((x0 + x1) / 2, (y0 + y1) / 2 + 0.12, label, ha="center", fontsize=7.5, style="italic")


def architecture():
    fig, ax = plt.subplots(figsize=(13, 6.2))
    ax.set_xlim(0, 13); ax.set_ylim(0.1, 6.4); ax.axis("off")
    c1, c2, c3 = "#DCEBF7", "#FBE9D0", "#D9F0E6"
    ax.text(2.1, 6.25, "OFFLINE (Python, run once)", ha="center", fontsize=11, fontweight="bold")
    ax.text(10.4, 6.25, "IN THE USER'S BROWSER (no server)", ha="center", fontsize=11, fontweight="bold")
    ax.plot([6.6, 6.6], [0.2, 6.1], ls="--", color="grey")
    box(ax, 0.2, 4.3, 3.8, 1.7, "1. Public data", "Kaggle: Spotify 1.2M+ Songs\nSpotify Tracks (114 genres)\nGenius lyrics (sample)", c1)
    box(ax, 0.2, 2.25, 3.8, 1.75, "2. Cleaning pipeline", "type fixes, MICE imputation\nscaling, log / Yeo-Johnson\nIQR + Isolation Forest flags", c1)
    box(ax, 0.2, 0.2, 3.8, 1.75, "3. Analysis notebooks", "descriptive stats, tests\nPCA / t-SNE / LLE, KMeans\nSTL, change points, text EDA", c1)
    box(ax, 4.3, 2.25, 2.1, 1.75, "4. Exports", "Parquet (lite/full)\nembeddings\nresults.json", c2)
    box(ax, 6.9, 4.3, 2.8, 1.7, "5. DuckDB-WASM", "SQL engine in a\nWeb Worker reads\nParquet via HTTP", c3)
    box(ax, 10.0, 4.3, 2.8, 1.7, "6. Query layer", "filter builder\nSQL console\nplain-English parser", c3)
    box(ax, 6.9, 1.3, 5.9, 2.5, "7. React user interface", "Home | Query Studio | Acoustic Map\nSonic Twins | Compare | Time Machine\nGenre Fingerprints | Lyrics Lab\nCollaboration Network | Data Profile\nMethodology  -  state kept in the URL", c3)
    arrow(ax, 2.1, 4.3, 2.1, 4.0); arrow(ax, 2.1, 2.25, 2.1, 1.95)
    arrow(ax, 4.0, 1.1, 5.35, 2.25, "results"); arrow(ax, 4.0, 3.1, 4.3, 3.1)
    arrow(ax, 6.4, 3.4, 6.9, 4.8, "static files")
    arrow(ax, 9.7, 5.15, 10.0, 5.15); arrow(ax, 11.4, 4.3, 11.4, 3.8, "Arrow tables")
    fig.suptitle("SonicAtlas system architecture: heavy computation offline, querying in the browser", fontweight="bold", y=0.99)
    theme.save(fig, "fig_00_01_system_architecture", source="SonicAtlas design (Team 05)")


def methodology():
    fig, ax = plt.subplots(figsize=(13, 2.6))
    ax.set_xlim(0, 13); ax.set_ylim(0, 2.6); ax.axis("off")
    steps = [("Acquire", "Kaggle public\ndata, audit"), ("Clean", "MICE, scaling\noutlier flags"), ("Describe", "n-1 variance\nTukey IQR, G1/G2"),
             ("Multivariate", "correlation\nparallel, Andrews"), ("Reduce", "PCA, SVD\nt-SNE, LLE"), ("Cluster", "KMeans\nHDBSCAN"),
             ("Time series", "STL, change\npoints, ARIMA"), ("Test", "ANOVA, chi-sq\nfeature select"), ("Deploy", "Parquet +\nDuckDB-WASM")]
    w = 1.3
    for i, (t, b) in enumerate(steps):
        x = 0.1 + i * 1.43
        box(ax, x, 0.35, w, 1.9, t, b, ["#DCEBF7", "#FBE9D0", "#D9F0E6"][i % 3])
        if i < len(steps) - 1:
            arrow(ax, x + w, 1.3, x + 1.43, 1.3)
    fig.suptitle("SonicAtlas methodology: from raw public data to an interactive in-browser tool", fontweight="bold", y=1.0)
    theme.save(fig, "fig_00_02_methodology_flow", source="SonicAtlas design (Team 05)")


if __name__ == "__main__":
    architecture()
    methodology()
