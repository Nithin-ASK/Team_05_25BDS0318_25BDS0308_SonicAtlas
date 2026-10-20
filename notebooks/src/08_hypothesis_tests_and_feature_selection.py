# %% [markdown]
# # 08 - Hypothesis tests and feature selection
# **Goal:** formal tests in the tutorial style (hypotheses, formula, statistic, p-value, decision, interpretation):
# one-way ANOVA + Tukey HSD, Kruskal-Wallis, Chi-square independence, effect sizes; then filter vs wrapper
# feature selection for separating genres.
#
# **Inputs:** `data/processed/genre_tracks.parquet`, `data/processed/tracks.parquet`.
#
# **Outputs:** `reports/tables/tab_08_*.csv`, figure `fig_08_*`, `results.json -> tests`.

# %%
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy import stats as ss
from statsmodels.stats.multicomp import pairwise_tukeyhsd
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.feature_selection import VarianceThreshold, f_classif, mutual_info_classif, RFE
from sklearn.linear_model import LogisticRegression
from sonicatlas import DATA, TAB, SEED, results, theme
from sonicatlas.stats import eta_squared, cramers_v

theme.apply()
gt = pd.read_parquet(DATA / "processed" / "genre_tracks.parquet")
a = pd.read_parquet(DATA / "processed" / "tracks.parquet", columns=["mode", "decade", "is_canonical"])
FOCUS = ["classical", "jazz", "country", "rock", "metal", "hip-hop", "edm", "pop"]
FEATS = ["danceability", "energy", "loudness", "speechiness", "acousticness", "instrumentalness", "liveness", "valence", "tempo", "duration_min"]
f8 = gt[gt.track_genre.isin(FOCUS)].copy()

# %% [markdown]
# ## Test 1 - One-way ANOVA: does mean danceability differ across the eight genres?
# * H0: mu_1 = mu_2 = ... = mu_8;  H1: at least one genre mean differs.
# * F = MS_between / MS_within = [SS_B / (k - 1)] / [SS_W / (N - k)];  alpha = 0.05.

# %%
groups = [f8.loc[f8.track_genre == g, "danceability"].to_numpy() for g in FOCUS]
k, N = len(groups), sum(len(g) for g in groups)
gm = np.concatenate(groups).mean()
ssb = sum(len(g) * (g.mean() - gm) ** 2 for g in groups)
ssw = sum(((g - g.mean()) ** 2).sum() for g in groups)
F_hand = (ssb / (k - 1)) / (ssw / (N - k))
F, p = ss.f_oneway(*groups)
eta2 = eta_squared(groups)
anova = {"k": k, "N": N, "SSB": ssb, "SSW": ssw, "df_between": k - 1, "df_within": N - k, "F": float(F), "F_hand": float(F_hand),
         "p": float(p), "eta_squared": eta2, "group_means": {g: float(x.mean()) for g, x in zip(FOCUS, groups)},
         "group_n": {g: len(x) for g, x in zip(FOCUS, groups)}}
print(anova)

# %%
tk = pairwise_tukeyhsd(f8["danceability"], f8["track_genre"], alpha=0.05)
tk_df = pd.DataFrame(tk.summary().data[1:], columns=tk.summary().data[0])
tk_df.to_csv(TAB / "tab_08_01_tukey_hsd_danceability.csv", index=False)
n_sig = int(tk_df["reject"].sum())
print(f"{n_sig} of {len(tk_df)} genre pairs differ significantly")
tk_df.sort_values("meandiff", key=abs, ascending=False).head(8)

# %% [markdown]
# ## Test 2 - Kruskal-Wallis (non-parametric check; danceability is bounded and not normal)

# %%
H, pk = ss.kruskal(*groups)
eps2 = (H - k + 1) / (N - k)
lev_W, lev_p = ss.levene(*groups)
print(H, pk, eps2, lev_W, lev_p)

# %% [markdown]
# ## Test 3 - Chi-square test of independence: mode (major/minor) vs genre, and mode vs decade
# * H0: mode and genre are independent;  chi2 = sum (O - E)^2 / E,  E = row total x column total / N.

# %%
ct_g = pd.crosstab(f8.track_genre, f8["mode"].map({1: "major", 0: "minor"}))
chi2_g, p_g, dof_g, exp_g = ss.chi2_contingency(ct_g)
v_g = cramers_v(ct_g, chi2_g)
ct_g.assign(major_pct=(ct_g["major"] / ct_g.sum(1) * 100).round(1)).to_csv(TAB / "tab_08_02_mode_by_genre.csv")
ac = a[a.is_canonical & a.decade.between(1950, 2010)]
ct_d = pd.crosstab(ac.decade, ac["mode"].map({1: "major", 0: "minor"}))
chi2_d, p_d, dof_d, _ = ss.chi2_contingency(ct_d)
v_d = cramers_v(ct_d, chi2_d)
ct_d.assign(major_pct=(ct_d["major"] / ct_d.sum(1) * 100).round(1)).to_csv(TAB / "tab_08_03_mode_by_decade.csv")
print(chi2_g, p_g, dof_g, v_g); print(chi2_d, p_d, dof_d, v_d)
ct_g.assign(major_pct=(ct_g["major"] / ct_g.sum(1) * 100).round(1))

# %%
ct_d.assign(major_pct=(ct_d["major"] / ct_d.sum(1) * 100).round(1))

# %% [markdown]
# ## Feature selection: filter methods vs wrapper (RFE) for separating the eight genres

# %%
X = f8[FEATS].to_numpy(); y = f8.track_genre.to_numpy()
Xmm = MinMaxScaler().fit_transform(X)
Xz = StandardScaler().fit_transform(X)
var = pd.Series(VarianceThreshold().fit(Xmm).variances_, index=FEATS)
Fv, _ = f_classif(X, y)
mi = mutual_info_classif(Xz, y, random_state=SEED)
corr_max = pd.DataFrame(Xz, columns=FEATS).corr().abs().where(lambda m: m < 1).max()
rfe = RFE(LogisticRegression(max_iter=2000), n_features_to_select=1).fit(Xz, y)
fs = pd.DataFrame({"variance_minmax": var, "anova_F": Fv, "mutual_info": mi, "max_abs_corr_other": corr_max, "rfe_rank": rfe.ranking_}, index=FEATS)
ranks = pd.DataFrame({"variance": fs.variance_minmax.rank(ascending=False), "anova_F": fs.anova_F.rank(ascending=False),
                      "mutual_info": fs.mutual_info.rank(ascending=False), "rfe": fs.rfe_rank}).astype(int)
fs = fs.join(ranks.add_suffix("_rank").drop(columns="rfe_rank"))
fs.to_csv(TAB / "tab_08_04_feature_selection.csv")
rank_corr = ranks.corr("spearman")
print(rank_corr.round(2))
fs.sort_values("anova_F", ascending=False).round(3)

# %%
fig, ax = plt.subplots(figsize=(10, 4))
x = np.arange(len(FEATS)); w = 0.2
for i, col in enumerate(["variance", "anova_F", "mutual_info", "rfe"]):
    ax.bar(x + (i - 1.5) * w, len(FEATS) + 1 - ranks[col], w, label=col, color=theme.OKABE_ITO[i], edgecolor="k", lw=0.4, hatch=["", "//", "..", "xx"][i])
ax.set_xticks(x, FEATS, rotation=35, ha="right")
top = ranks.sum(1).sort_values().index[:2]
ax.set(title=f"{top[0].capitalize()} and {top[1]} rank highest for separating genres in filter and wrapper methods",
       ylabel="Importance (11 - rank)")
ax.legend(ncol=4, loc="upper center", bbox_to_anchor=(0.5, -0.32))
theme.save(fig, "fig_08_01_feature_selection_ranks")

# %%
results.save("tests", {
    "anova": anova, "tukey_sig_pairs": n_sig, "tukey_pairs": len(tk_df),
    "kruskal": {"H": float(H), "p": float(pk), "epsilon_squared": float(eps2)},
    "levene": {"W": float(lev_W), "p": float(lev_p)},
    "chi2_mode_genre": {"chi2": float(chi2_g), "p": float(p_g), "dof": int(dof_g), "cramers_v": v_g,
                        "major_pct": (ct_g["major"] / ct_g.sum(1) * 100).to_dict()},
    "chi2_mode_decade": {"chi2": float(chi2_d), "p": float(p_d), "dof": int(dof_d), "cramers_v": v_d,
                         "major_pct": {int(k): float(v) for k, v in (ct_d["major"] / ct_d.sum(1) * 100).items()}},
    "feature_ranks": ranks.to_dict(), "rank_spearman": rank_corr.to_dict(),
    "top3_anova": fs.sort_values("anova_F", ascending=False).index[:3].tolist(),
    "top3_rfe": fs.sort_values("rfe_rank").index[:3].tolist(),
    "top3_mi": fs.sort_values("mutual_info", ascending=False).index[:3].tolist(),
})
