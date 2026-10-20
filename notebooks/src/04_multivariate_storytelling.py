# %% [markdown]
# # 04 - Multivariate storytelling
# **Goal:** correlation structure (Pearson and Spearman), a worked Pearson example, and high-dimensional views per
# genre: parallel coordinates, Andrews curves, radar fingerprints and violin plots.
#
# **Inputs:** `data/processed/tracks.parquet`, `data/processed/genre_tracks.parquet`.
#
# **Outputs:** figures `fig_04_*`, `reports/tables/tab_04_*.csv`, `results.json -> multivariate`.

# %%
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pandas.plotting import parallel_coordinates, andrews_curves
from sonicatlas import DATA, TAB, AUDIO_FEATURES, UNIT_FEATURES, SEED, results, theme
from sonicatlas.stats import pearson_r

theme.apply()
a = pd.read_parquet(DATA / "processed" / "tracks.parquet")
gt = pd.read_parquet(DATA / "processed" / "genre_tracks.parquet")
FOCUS = ["classical", "jazz", "country", "rock", "metal", "hip-hop", "edm", "pop"]

# %% [markdown]
# ## Pearson and Spearman correlation heatmaps

# %%
s = a.sample(300_000, random_state=SEED)
pear = s[AUDIO_FEATURES].corr("pearson")
spear = s[AUDIO_FEATURES].corr("spearman")
pear.to_csv(TAB / "tab_04_01_pearson.csv"); spear.to_csv(TAB / "tab_04_02_spearman.csv")
fig, axes = plt.subplots(1, 2, figsize=(14, 5.8))
for ax, m, t in [(axes[0], pear, "Pearson r"), (axes[1], spear, "Spearman rho")]:
    im = ax.imshow(m, cmap="RdBu_r", vmin=-1, vmax=1)
    ax.set_xticks(range(len(m)), m.columns, rotation=45, ha="right")
    ax.set_yticks(range(len(m)), m.index)
    for i in range(len(m)):
        for j in range(len(m)):
            v = m.iloc[i, j]
            ax.text(j, i, f"{v:.2f}", ha="center", va="center", fontsize=7, color="white" if abs(v) > 0.55 else "black")
    ax.set_title(t); ax.grid(False)
fig.colorbar(im, ax=axes, shrink=0.7, label="Correlation coefficient")
fig.suptitle(f"Energy rises with loudness (r = {pear.loc['energy', 'loudness']:.2f}) and falls with acousticness "
             f"(r = {pear.loc['energy', 'acousticness']:.2f})", fontweight="bold")
theme.save(fig, "fig_04_01_correlation_heatmaps")

# %%
pairs = {}
for x, y in [("energy", "acousticness"), ("loudness", "energy"), ("valence", "danceability"),
             ("loudness", "acousticness"), ("instrumentalness", "speechiness")]:
    pairs[f"{x}~{y}"] = {"pearson": float(pear.loc[x, y]), "spearman": float(spear.loc[x, y])}
pd.DataFrame(pairs).T

# %% [markdown]
# ## Worked Pearson example by formula (first 10 tracks of the sample)
# r = sum((x - mean_x)(y - mean_y)) / sqrt(sum(x - mean_x)^2 * sum(y - mean_y)^2)

# %%
w = s.head(10)[["name", "energy", "loudness"]].reset_index(drop=True)
w["dx"] = w.energy - w.energy.mean(); w["dy"] = w.loudness - w.loudness.mean()
w["dx*dy"] = w.dx * w.dy; w["dx^2"] = w.dx ** 2; w["dy^2"] = w.dy ** 2
r_hand = w["dx*dy"].sum() / np.sqrt(w["dx^2"].sum() * w["dy^2"].sum())
r_np = np.corrcoef(w.energy, w.loudness)[0, 1]
w.round(4).to_csv(TAB / "tab_04_03_worked_pearson.csv", index=False)
print(w.round(4).to_string()); print("by hand:", r_hand, " numpy:", r_np, " package:", pearson_r(w.energy, w.loudness))

# %% [markdown]
# ## Balanced genre sample for high-dimensional views

# %%
bal = gt[gt.track_genre.isin(FOCUS)].groupby("track_genre").sample(60, random_state=SEED)
cols = ["danceability", "energy", "acousticness", "valence", "speechiness", "instrumentalness", "liveness"]
lin = dict(zip(FOCUS, theme.LINESTYLES))
fig, ax = plt.subplots(figsize=(12, 5))
sub = bal[cols + ["track_genre"]].copy()
parallel_coordinates(sub, "track_genre", ax=ax, color=theme.OKABE_ITO, alpha=0.35, lw=0.9)
means = bal.groupby("track_genre")[cols].mean()
for i, gname in enumerate(sorted(FOCUS)):
    ax.plot(range(len(cols)), means.loc[gname], color=theme.OKABE_ITO[i % 8], lw=3, ls=theme.LINESTYLES[i], marker=theme.MARKERS[i])
ax.set(title="Classical separates on acousticness/instrumentalness; hip-hop on speechiness; EDM/metal on energy",
       ylabel="Feature value (0-1)")
ax.legend(ncol=8, loc="upper center", bbox_to_anchor=(0.5, -0.08), fontsize=8)
theme.save(fig, "fig_04_02_parallel_coordinates_genres")

# %%
fig, ax = plt.subplots(figsize=(11, 4.8))
andrews_curves(bal[cols + ["track_genre"]], "track_genre", ax=ax, color=theme.OKABE_ITO, alpha=0.25, lw=0.7)
ax.set(title="Andrews curves: classical traces a distinct waveform; the other seven genres largely overlap",
       xlabel="t (radians)", ylabel="f(t)")
ax.legend(ncol=8, fontsize=8, loc="upper center", bbox_to_anchor=(0.5, -0.12))
theme.save(fig, "fig_04_03_andrews_curves_genres")

# %% [markdown]
# ## Radar fingerprints and violins per genre

# %%
gm = gt[gt.track_genre.isin(FOCUS)].groupby("track_genre")[cols].mean()
gm.to_csv(TAB / "tab_04_04_genre_fingerprints.csv")
ang = np.linspace(0, 2 * np.pi, len(cols), endpoint=False).tolist() + [0]
fig, axes = plt.subplots(2, 4, figsize=(14, 7), subplot_kw={"polar": True})
for i, (ax, gname) in enumerate(zip(axes.ravel(), FOCUS)):
    v = gm.loc[gname].tolist() + [gm.loc[gname].iloc[0]]
    ax.plot(ang, v, color=theme.OKABE_ITO[i], lw=2, marker=theme.MARKERS[i])
    ax.fill(ang, v, color=theme.OKABE_ITO[i], alpha=0.25)
    ax.set_xticks(ang[:-1], [c[:6] for c in cols], fontsize=7)
    ax.set_ylim(0, 1); ax.set_yticks([0.25, 0.5, 0.75], ["", "", ""])
    ax.set_title(gname, fontsize=11, pad=12)
fig.suptitle("Genre fingerprints: mean audio profile of eight representative genres", fontweight="bold")
fig.tight_layout()
theme.save(fig, "fig_04_04_radar_genre_fingerprints")

# %%
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))
sub = gt[gt.track_genre.isin(FOCUS)]
for ax, c in zip(axes, ["danceability", "energy", "valence"]):
    data = [sub.loc[sub.track_genre == gname, c] for gname in FOCUS]
    parts = ax.violinplot(data, showmedians=True)
    for i, pc in enumerate(parts["bodies"]):
        pc.set_facecolor(theme.OKABE_ITO[i]); pc.set_alpha(0.6); pc.set_edgecolor("k")
    ax.set_xticks(range(1, len(FOCUS) + 1), FOCUS, rotation=40, ha="right")
    ax.set(title=f"{c.capitalize()} by genre", ylabel=f"{c} (0-1)")
fig.suptitle("Violin plots: hip-hop and EDM are the most danceable; classical the least energetic", fontweight="bold")
fig.tight_layout()
theme.save(fig, "fig_04_05_violins_by_genre")

# %%
results.save("multivariate", {
    "pairs": pairs, "pearson": pear.to_dict(), "spearman": spear.to_dict(),
    "worked_pearson": {"r_hand": float(r_hand), "r_numpy": float(r_np), "n": 10},
    "genre_fingerprints": gm.to_dict(orient="index"),
    "focus_genres": FOCUS, "balanced_per_genre": 60,
    "strongest_pair": max(pairs, key=lambda k: abs(pairs[k]["pearson"])),
})
