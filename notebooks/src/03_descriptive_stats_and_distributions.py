# %% [markdown]
# # 03 - Descriptive statistics and distributions
# **Goal:** per-feature summaries in the course conventions (n-1 variance, Tukey quartiles, G1, G2), per genre and
# per decade, plus histograms and categorical bar charts.
#
# **Inputs:** `data/processed/tracks.parquet`, `data/processed/genre_tracks.parquet`.
#
# **Outputs:** `reports/tables/tab_03_*.csv`, figures `fig_03_*`, `results.json -> descriptive`.

# %%
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy import stats as ss
from sonicatlas import DATA, TAB, AUDIO_FEATURES, results, theme
from sonicatlas.stats import describe, describe_frame, tukey_quartiles

theme.apply()
a = pd.read_parquet(DATA / "processed" / "tracks.parquet")
gt = pd.read_parquet(DATA / "processed" / "genre_tracks.parquet")
FOCUS = ["classical", "jazz", "country", "rock", "metal", "hip-hop", "edm", "pop"]

# %% [markdown]
# ## Worked example: the tutorial data set 4, 5, 5, 6, 6, 6, 7, 8, 9, 14

# %%
tut = [4, 5, 5, 6, 6, 6, 7, 8, 9, 14]
d = describe(tut)
print({k: d[k] for k in ["mean", "median", "mode", "variance", "q1", "q3", "iqr", "q1_pandas", "q3_pandas", "g1", "g2", "pearson_kurtosis"]})
print("scipy check:", ss.skew(tut, bias=False), ss.kurtosis(tut, bias=False))

# %% [markdown]
# ## Whole-catalogue summary (1,204,025 tracks)

# %%
desc = describe_frame(a, AUDIO_FEATURES)
desc.to_csv(TAB / "tab_03_01_descriptive_all.csv")
desc[["n", "mean", "median", "mode", "variance", "std", "q1", "q3", "iqr", "g1", "g2", "cv", "shape"]]

# %% [markdown]
# Tukey quartiles vs pandas default (linear interpolation) - on a million rows the two methods agree to 3 decimals;
# the report uses Tukey values.

# %%
(desc[["q1", "q1_pandas", "q3", "q3_pandas"]].astype(float)).round(4)

# %% [markdown]
# ## Per-genre and per-decade tables

# %%
rows = []
for gname, grp in gt[gt.track_genre.isin(FOCUS)].groupby("track_genre"):
    for c in ["danceability", "energy", "valence", "acousticness", "loudness", "tempo"]:
        rows.append({"genre": gname, "feature": c, **{k: v for k, v in describe(grp[c]).items() if k != "shape"}})
by_genre = pd.DataFrame(rows)
by_genre.to_csv(TAB / "tab_03_02_descriptive_by_genre.csv", index=False)
by_genre.pivot(index="genre", columns="feature", values="mean").round(3)

# %%
canon = a[a.is_canonical & a.decade.notna() & (a.decade >= 1950)]
rows = []
for dec, grp in canon.groupby("decade"):
    for c in ["danceability", "energy", "valence", "acousticness", "loudness", "duration_min"]:
        rows.append({"decade": int(dec), "feature": c, **{k: v for k, v in describe(grp[c]).items() if k != "shape"}})
by_dec = pd.DataFrame(rows)
by_dec.to_csv(TAB / "tab_03_03_descriptive_by_decade.csv", index=False)
by_dec.pivot(index="decade", columns="feature", values="mean").round(3)

# %% [markdown]
# ## Histograms with KDE

# %%
s = a.sample(200_000, random_state=42)
fig, axes = plt.subplots(2, 5, figsize=(15, 5.6))
units = {"loudness": "dB", "tempo": "BPM", "duration_min": "min"}
for ax, c in zip(axes.ravel(), AUDIO_FEATURES):
    x = s[c].clip(upper=s[c].quantile(0.995))
    ax.hist(x, bins=50, density=True, color=theme.OKABE_ITO[0], alpha=0.55)
    kde = ss.gaussian_kde(x.sample(20_000, random_state=42))
    xs = np.linspace(x.min(), x.max(), 200)
    ax.plot(xs, kde(xs), color="k", lw=1.4)
    ax.set_title(f"{c}  (G1={desc.loc[c, 'g1']:.2f})", fontsize=10)
    ax.set_xlabel(f"{c} ({units.get(c, '0-1')})", fontsize=8)
    ax.set_ylabel("Density", fontsize=8)
fig.suptitle("Speechiness, liveness and duration are strongly right-skewed; danceability is near-symmetric", fontweight="bold")
fig.tight_layout()
theme.save(fig, "fig_03_01_feature_histograms_kde")

# %% [markdown]
# ## Bar charts: key, mode, genres, explicit share

# %%
fig, axes = plt.subplots(1, 3, figsize=(15, 3.8))
kc = a["key_name"].str.split(" ").str[0].value_counts().reindex(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])
axes[0].bar(kc.index, kc.values / 1000, color=theme.OKABE_ITO[0], edgecolor="k", lw=0.4)
top3 = kc.sort_values(ascending=False).index[:3]
axes[0].set(title=f"{top3[0]}, {top3[1]} and {top3[2]} are the most common keys", xlabel="Key (pitch class)", ylabel="Tracks (thousands)")
mc = a["mode_name"].value_counts()
axes[1].bar(mc.index, mc.values / 1000, color=[theme.OKABE_ITO[1], theme.OKABE_ITO[2]], edgecolor="k", hatch="//")
axes[1].set(title=f"{100 * mc['major'] / mc.sum():.1f}% of tracks are in a major key", xlabel="Mode", ylabel="Tracks (thousands)")
ex = canon.groupby("decade")["explicit"].mean() * 100
axes[2].plot(ex.index.astype(int), ex.values, marker="o", color=theme.OKABE_ITO[3])
axes[2].set(title=f"Explicit share: {ex.iloc[0]:.1f}% ({int(ex.index[0])}s) to {ex.iloc[-1]:.1f}% ({int(ex.index[-1])}s)", xlabel="Decade", ylabel="Explicit tracks (%)")
fig.tight_layout()
theme.save(fig, "fig_03_02_key_mode_explicit_bars")

# %%
gc = gt["track_genre"].value_counts()
fig, ax = plt.subplots(figsize=(7, 3.4))
ax.hist(gc.values, bins=30, color=theme.OKABE_ITO[2], edgecolor="k", lw=0.4)
ax.set(title="After removing multi-genre duplicates genre sizes range widely",
       xlabel="Unique tracks per genre", ylabel="Number of genres")
theme.save(fig, "fig_03_03_genre_size_distribution")

# %%
results.save("descriptive", {
    "tutorial": {k: d[k] for k in ["mean", "median", "mode", "variance", "std", "q1", "q3", "iqr", "q1_pandas", "q3_pandas", "g1", "g2", "pearson_kurtosis"]},
    "all": desc.drop(columns="shape").astype(float).to_dict(orient="index"),
    "shape": desc["shape"].to_dict(),
    "major_pct": 100 * float(mc["major"] / mc.sum()),
    "top_keys": kc.sort_values(ascending=False).head(3).index.tolist(),
    "explicit_pct_by_decade": {int(k): float(v) for k, v in ex.items()},
    "explicit_pct_all": 100 * float(a.explicit.mean()),
    "genre_means": by_genre.pivot(index="genre", columns="feature", values="mean").to_dict(orient="index"),
    "decade_means": {int(k): v for k, v in by_dec.pivot(index="decade", columns="feature", values="mean").to_dict(orient="index").items()},
    "genre_size_min": int(gc.min()), "genre_size_max": int(gc.max()),
    "genre_size_min_name": gc.idxmin(), "genre_size_max_name": gc.idxmax(),
    "n_artists": int(a.artist_main.nunique()), "n_albums": int(a.album_id.nunique()),
    "canonical_since_1950": len(canon),
})
