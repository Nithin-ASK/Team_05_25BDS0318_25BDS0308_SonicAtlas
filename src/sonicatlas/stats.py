"""Descriptive statistics using the conventions of the BACSE301 tutorials.

Conventions
-----------
* Sample variance uses the n-1 denominator.
* Q1/Q3 use Tukey's median-of-halves (hinges): the data are split at the
  median; when n is odd the median is included in both halves (Tukey's
  original hinges).
* Skewness is the adjusted Fisher-Pearson coefficient G1.
* Kurtosis is the bias-corrected excess kurtosis G2; Pearson kurtosis = G2 + 3.
"""
from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd


def _clean(x: Iterable[float]) -> np.ndarray:
    a = np.asarray(pd.Series(x).dropna(), dtype=float)
    return a


def sample_variance(x: Iterable[float]) -> float:
    """Variance with the n-1 denominator."""
    a = _clean(x)
    n = a.size
    return float(((a - a.mean()) ** 2).sum() / (n - 1))


def tukey_quartiles(x: Iterable[float]) -> tuple[float, float, float]:
    """Return (Q1, median, Q3) by Tukey's median-of-halves method."""
    a = np.sort(_clean(x))
    n = a.size
    half = n // 2
    # Tukey's hinges: for odd n the median belongs to both halves.
    lower = a[:half + 1] if n % 2 else a[:half]
    upper = a[half:]
    return float(np.median(lower)), float(np.median(a)), float(np.median(upper))


def skewness_g1(x: Iterable[float]) -> float:
    """Adjusted Fisher-Pearson standardized moment coefficient G1."""
    a = _clean(x)
    n = a.size
    m = a.mean()
    m2 = ((a - m) ** 2).mean()
    m3 = ((a - m) ** 3).mean()
    g1 = m3 / m2 ** 1.5
    return float(np.sqrt(n * (n - 1)) / (n - 2) * g1)


def excess_kurtosis_g2(x: Iterable[float]) -> float:
    """Bias-corrected sample excess kurtosis G2."""
    a = _clean(x)
    n = a.size
    m = a.mean()
    m2 = ((a - m) ** 2).mean()
    m4 = ((a - m) ** 4).mean()
    g2 = m4 / m2 ** 2 - 3
    return float((n - 1) / ((n - 2) * (n - 3)) * ((n + 1) * g2 + 6))


def pearson_r(x: Iterable[float], y: Iterable[float]) -> float:
    """Pearson r by the textbook formula sum(dx*dy)/sqrt(sum dx^2 * sum dy^2)."""
    a, b = np.asarray(list(x), float), np.asarray(list(y), float)
    dx, dy = a - a.mean(), b - b.mean()
    return float((dx * dy).sum() / np.sqrt((dx ** 2).sum() * (dy ** 2).sum()))


def shape_words(g1: float, g2: float) -> str:
    """Plain-English reading of a distribution's shape."""
    if abs(g1) < 0.5:
        s = "roughly symmetric"
    elif g1 > 0:
        s = "right-skewed (long tail of high values)" if g1 >= 1 else "moderately right-skewed"
    else:
        s = "left-skewed (long tail of low values)" if g1 <= -1 else "moderately left-skewed"
    if g2 > 1:
        k = "heavy-tailed (leptokurtic)"
    elif g2 < -1:
        k = "flat (platykurtic)"
    else:
        k = "near-normal tails (mesokurtic)"
    return f"{s}, {k}"


def describe(x: Iterable[float]) -> dict[str, float | str]:
    """Full descriptive summary in the tutorial conventions."""
    a = _clean(x)
    q1, med, q3 = tukey_quartiles(a)
    var = sample_variance(a)
    sd = var ** 0.5
    vals, counts = np.unique(np.round(a, 3), return_counts=True)
    g1, g2 = skewness_g1(a), excess_kurtosis_g2(a)
    mean = float(a.mean())
    return {
        "n": int(a.size),
        "mean": mean,
        "median": med,
        "mode": float(vals[counts.argmax()]),
        "variance": var,
        "std": sd,
        "min": float(a.min()),
        "max": float(a.max()),
        "range": float(a.max() - a.min()),
        "q1": q1,
        "q3": q3,
        "iqr": q3 - q1,
        "q1_pandas": float(np.percentile(a, 25)),
        "q3_pandas": float(np.percentile(a, 75)),
        "g1": g1,
        "g2": g2,
        "pearson_kurtosis": g2 + 3,
        "cv": sd / mean if mean != 0 else float("nan"),
        "shape": shape_words(g1, g2),
    }


def describe_frame(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    """Apply :func:`describe` to every column and return a tidy table."""
    return pd.DataFrame({c: describe(df[c]) for c in cols}).T


def cramers_v(table: pd.DataFrame | np.ndarray, chi2: float) -> float:
    """Cramer's V effect size for a contingency table."""
    t = np.asarray(table)
    n = t.sum()
    k = min(t.shape) - 1
    return float(np.sqrt(chi2 / (n * k)))


def eta_squared(groups: list[np.ndarray]) -> float:
    """Eta squared = SS_between / SS_total for one-way ANOVA."""
    allv = np.concatenate(groups)
    gm = allv.mean()
    ssb = sum(g.size * (g.mean() - gm) ** 2 for g in groups)
    sst = ((allv - gm) ** 2).sum()
    return float(ssb / sst)
