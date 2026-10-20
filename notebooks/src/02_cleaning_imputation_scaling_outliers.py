# %% [markdown]
# # 02 - Cleaning, MICE imputation, scaling and outliers
# **Goal:** turn the audited raw tables into clean analysis tables: fix types, treat impossible values with MICE,
# scale and transform features, flag (never drop) outliers, and join genre labels to the 1.2M table.
#
# **Inputs:** `data/interim/spotify_12m.parquet`, `data/interim/spotify_tracks_114k.parquet`.
#
# **Outputs:** `data/processed/tracks.parquet`, `genre_tracks.parquet`, `tracks_minmax.parquet`,
# `tracks_standard.parquet`; figures `fig_02_*`; `results.json -> cleaning`.

# %%
import ast
import time
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.experimental import enable_iterative_imputer  # noqa: F401
from sklearn.impute import IterativeImputer
from sklearn.preprocessing import MinMaxScaler, StandardScaler, PowerTransformer
from sklearn.ensemble import IsolationForest
from sonicatlas import DATA, SEED, AUDIO_FEATURES, results, theme
from sonicatlas.stats import skewness_g1, tukey_quartiles

theme.apply()
rng = np.random.default_rng(SEED)
a = pd.read_parquet(DATA / "interim" / "spotify_12m.parquet")
g = pd.read_parquet(DATA / "interim" / "spotify_tracks_114k.parquet")
KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# %% [markdown]
# ## 1. Types: dates, decade, key names, explicit flag, artist lists

# %%
def parse_list(s):
    try:
        return ast.literal_eval(s) if isinstance(s, str) and s.startswith("[") else [s]
    except (ValueError, SyntaxError):
        return [s]

a["artists_list"] = a["artists"].map(parse_list)
a["artist_main"] = a["artists_list"].str[0]
a["n_artists"] = a["artists_list"].str.len()
raw_len = a["release_date"].astype(str).str.len()
a["release_date"] = pd.to_datetime(a["release_date"], errors="coerce", format="mixed")
a["date_precision"] = np.select([a["release_date"].isna(), raw_len >= 10, raw_len == 7], ["unknown", "day", "month"], "year")
a.loc[a.year < 1900, "year"] = np.nan
a["decade"] = (a["year"] // 10 * 10).astype("Int64")
a["explicit"] = a["explicit"].astype(bool)
a["duration_min"] = a["duration_ms"] / 60000
a["key_name"] = a["key"].map(lambda k: KEYS[int(k)]) + np.where(a["mode"] == 1, " major", " minor")
a["mode_name"] = np.where(a["mode"] == 1, "major", "minor")
print(a[["release_date", "year", "decade", "key_name", "date_precision"]].head())
print(a["date_precision"].value_counts())

# %% [markdown]
# ## 2. Impossible values -> missing, then MICE (IterativeImputer)
# Tempo = 0 BPM and time signature = 0 are impossible for music, so they are treated as missing.
# Name/album text gaps are filled with a constant ("Unknown"), the categorical strategy.

# %%
a["tempo_raw"] = a["tempo"]
a.loc[a.tempo == 0, "tempo"] = np.nan
a.loc[a.time_signature == 0, "time_signature"] = np.nan
a[["name", "album"]] = a[["name", "album"]].fillna("Unknown")
predictors = ["danceability", "energy", "loudness", "speechiness", "acousticness",
              "instrumentalness", "liveness", "valence", "duration_min"]
imp_cols = predictors + ["tempo", "time_signature"]
n_missing_tempo = int(a.tempo.isna().sum())
n_missing_ts = int(a.time_signature.isna().sum())

t0 = time.time()
mice = IterativeImputer(max_iter=10, random_state=SEED, sample_posterior=False)
fit_idx = rng.choice(len(a), 200_000, replace=False)
mice.fit(a.iloc[fit_idx][imp_cols])
filled = mice.transform(a[imp_cols])
a["tempo_imputed"] = a["tempo"].isna()
a["tempo"] = filled[:, imp_cols.index("tempo")]
a["time_signature"] = np.clip(np.round(filled[:, imp_cols.index("time_signature")]), 1, 7)
mice_seconds = time.time() - t0
print(n_missing_tempo, n_missing_ts, round(mice_seconds, 1))

# %% [markdown]
# ### MICE validation: mask 5 % of known values and measure the error
# The audio features themselves have no gaps, so we hide 5 % of known tempo and valence values,
# impute them, and compare MICE with simple mean imputation.

# %%
known = a.loc[~a.tempo_imputed].sample(100_000, random_state=SEED)
val = {}
for col in ["tempo", "valence", "energy"]:
    test = known[imp_cols].copy()
    mask = rng.random(len(test)) < 0.05
    truth = test.loc[mask, col].to_numpy()
    test.loc[mask, col] = np.nan
    est = IterativeImputer(max_iter=10, random_state=SEED).fit_transform(test)[mask, imp_cols.index(col)]
    rmse_mice = float(np.sqrt(np.mean((est - truth) ** 2)))
    rmse_mean = float(np.sqrt(np.mean((test[col].mean() - truth) ** 2)))
    val[col] = {"masked": int(mask.sum()), "rmse_mice": rmse_mice, "rmse_mean": rmse_mean,
                "improvement_pct": 100 * (1 - rmse_mice / rmse_mean)}
pd.DataFrame(val).T

# %%
fig, ax = plt.subplots(1, 2, figsize=(12, 3.8))
bins = np.linspace(40, 220, 60)
ax[0].hist(a.loc[~a.tempo_imputed, "tempo"], bins=bins, density=True, histtype="step", lw=1.8, label="observed")
ax[0].hist(a["tempo"], bins=bins, density=True, histtype="step", lw=1.5, ls="--", label="after MICE (all rows)")
ax[0].set(title="Tempo distribution is unchanged by MICE", xlabel="Tempo (BPM)", ylabel="Density")
ax[0].legend()
ax[1].hist(a.loc[a.tempo_imputed, "tempo"], bins=bins, color=theme.OKABE_ITO[1], edgecolor="k", lw=0.3)
ax[1].set(title=f"{n_missing_tempo:,} imputed tempos centre near {np.median(a.loc[a.tempo_imputed, 'tempo']):.0f} BPM", xlabel="Imputed tempo (BPM)", ylabel="Tracks")
theme.save(fig, "fig_02_01_mice_tempo_before_after")

# %% [markdown]
# ## 3. Re-releases: canonical copy of each title + artist
# The same song often appears on several albums (original, deluxe, compilation). We keep every row but mark the
# earliest release as `is_canonical`, so time trends are not inflated by re-issues.

# %%
def norm(s):
    return s.astype(str).str.lower().str.replace(r"[^a-z0-9 ]", "", regex=True).str.strip()

a["title_artist_key"] = norm(a["name"]) + "|" + norm(a["artist_main"])
a = a.sort_values(["year", "release_date"], na_position="last")
a["is_canonical"] = ~a["title_artist_key"].duplicated()
a = a.sort_index()
print(a.is_canonical.value_counts())

# %% [markdown]
# ## 4. Genre table: de-duplicate and join to the 1.2M table

# %%
g = g.dropna(subset=["track_name"]).copy()
genres_per_track = g.groupby("track_id")["track_genre"].agg(list)
gt = g.drop_duplicates("track_id").copy()
gt["genres_all"] = gt["track_id"].map(genres_per_track)
gt["n_genres"] = gt["genres_all"].str.len()
gt["tempo_raw"] = gt["tempo"]
gt.loc[gt.tempo == 0, "tempo"] = np.nan
gt["duration_min"] = gt["duration_ms"] / 60000
gt["time_signature"] = gt["time_signature"].replace(0, np.nan)
g_fill = mice.transform(gt[imp_cols])
gt["tempo_imputed"] = gt["tempo"].isna()
gt["tempo"] = g_fill[:, imp_cols.index("tempo")]
gt["time_signature"] = np.clip(np.round(g_fill[:, imp_cols.index("time_signature")]), 1, 7)
gt["key_name"] = gt["key"].map(lambda k: KEYS[int(k)]) + np.where(gt["mode"] == 1, " major", " minor")
gt["mode_name"] = np.where(gt["mode"] == 1, "major", "minor")
gt["artist_main"] = gt["artists"].str.split(";").str[0]
gt["log_popularity"] = np.log1p(gt["popularity"])

id_match = gt["track_id"].isin(a["id"])
gt["title_artist_key"] = norm(gt["track_name"]) + "|" + norm(gt["artist_main"])
canon = a.loc[a.is_canonical, ["title_artist_key", "year"]].drop_duplicates("title_artist_key")
ta_match = (~id_match) & gt["title_artist_key"].isin(canon["title_artist_key"])
year_by_id = a.set_index("id")["year"]
gt["year"] = gt["track_id"].map(year_by_id)
gt.loc[ta_match, "year"] = gt.loc[ta_match, "title_artist_key"].map(canon.set_index("title_artist_key")["year"])
gt["year_source"] = np.select([id_match, ta_match], ["track_id", "title+artist"], "none")
gt["decade"] = (gt["year"] // 10 * 10).astype("Int64")
join = {"genre_unique_tracks": len(gt), "id_matches": int(id_match.sum()),
        "title_artist_matches": int(ta_match.sum()),
        "match_rate_pct": 100 * float((id_match | ta_match).mean()),
        "id_match_rate_pct": 100 * float(id_match.mean())}
a["track_genre"] = a["id"].map(gt.set_index("track_id")["track_genre"])
print(join)

# %% [markdown]
# ## 5. Skewness before and after transformation (log1p, Yeo-Johnson)

# %%
skew_rows = {}
a["log_duration"] = np.log1p(a["duration_min"])
skew_rows["duration_min"] = (skewness_g1(a.duration_min), skewness_g1(a.log_duration), "log1p")
pt = PowerTransformer(method="yeo-johnson", standardize=False)
sample = a.sample(200_000, random_state=SEED)
for c in ["speechiness", "instrumentalness", "liveness", "acousticness"]:
    pt.fit(sample[[c]])
    a[f"yj_{c}"] = pt.transform(a[[c]]).ravel()
    skew_rows[c] = (skewness_g1(a[c]), skewness_g1(a[f"yj_{c}"]), f"Yeo-Johnson (lambda={pt.lambdas_[0]:.2f})")
skew_rows["popularity (genre table)"] = (skewness_g1(gt.popularity), skewness_g1(gt.log_popularity), "log1p")
skew_tab = pd.DataFrame(skew_rows, index=["G1_before", "G1_after", "transform"]).T
skew_tab.to_csv(DATA.parent / "reports" / "tables" / "tab_02_skew_before_after.csv")
skew_tab

# %%
fig, ax = plt.subplots(1, 2, figsize=(10, 3.4))
ax[0].hist(a.duration_min.clip(upper=15), bins=80, color=theme.OKABE_ITO[0])
ax[0].set(title=f"Raw duration is right-skewed (G1 = {skew_rows['duration_min'][0]:.1f})", xlabel="Duration (min, clipped at 15)", ylabel="Tracks")
ax[1].hist(a.log_duration, bins=80, color=theme.OKABE_ITO[2])
ax[1].set(title=f"log1p brings G1 to {skew_rows['duration_min'][1]:.2f}", xlabel="log(1 + duration in min)", ylabel="Tracks")
theme.save(fig, "fig_02_02_duration_log_transform")

# %% [markdown]
# ## 6. Scaling: Min-Max (0-1) and Standard (z-score), stored separately

# %%
proc = DATA / "processed"
proc.mkdir(exist_ok=True)
mm = pd.DataFrame(MinMaxScaler().fit_transform(a[AUDIO_FEATURES]), columns=AUDIO_FEATURES)
zs = pd.DataFrame(StandardScaler().fit_transform(a[AUDIO_FEATURES]), columns=AUDIO_FEATURES)
mm.insert(0, "id", a["id"].values)
zs.insert(0, "id", a["id"].values)
mm.to_parquet(proc / "tracks_minmax.parquet", index=False)
zs.to_parquet(proc / "tracks_standard.parquet", index=False)
mm.describe().loc[["min", "max"]]

# %% [markdown]
# ## 7. Outliers: Tukey fences (IQR) per feature and Isolation Forest (multivariate)

# %%
iqr_counts = {}
for c in AUDIO_FEATURES:
    q1, _, q3 = tukey_quartiles(a[c])
    lo, hi = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
    flag = (a[c] < lo) | (a[c] > hi)
    a[f"iqr_out_{c}"] = flag
    iqr_counts[c] = {"lower_fence": lo, "upper_fence": hi, "n_outliers": int(flag.sum()), "pct": 100 * float(flag.mean())}
iqr_tab = pd.DataFrame(iqr_counts).T
iqr_tab.to_csv(DATA.parent / "reports" / "tables" / "tab_02_iqr_outliers.csv")

t0 = time.time()
iso = IsolationForest(n_estimators=200, contamination=0.02, random_state=SEED, n_jobs=-1)
iso.fit(zs.iloc[fit_idx][AUDIO_FEATURES])
a["iso_score"] = -iso.score_samples(zs[AUDIO_FEATURES])
a["is_outlier"] = iso.predict(zs[AUDIO_FEATURES]) == -1
iso_seconds = time.time() - t0
iqr_tab

# %%
examples = {
    "extreme_tempo": a.loc[a.tempo > 220, ["name", "artist_main", "tempo", "is_outlier"]].head(5),
    "near_silent": a.loc[a.loudness < -45, ["name", "artist_main", "loudness", "energy", "is_outlier"]].head(5),
    "spoken_word": a.loc[a.speechiness > 0.9, ["name", "artist_main", "speechiness", "is_outlier"]].head(5),
}
ex_counts = {"tempo_over_220": int((a.tempo > 220).sum()), "loudness_below_-45": int((a.loudness < -45).sum()),
             "speechiness_over_0.66": int((a.speechiness > 0.66).sum()), "speechiness_over_0.9": int((a.speechiness > 0.9).sum())}
for k, v in examples.items():
    print(k); print(v.to_string()); print()
print(ex_counts)

# %%
pd.concat(examples, names=["case"]).to_csv(DATA.parent / "reports" / "tables" / "tab_02_outlier_examples.csv")
iso_profile = a.groupby("is_outlier")[AUDIO_FEATURES].mean().T
iso_profile

# %%
fig, ax = plt.subplots(figsize=(7, 3.6))
s = a.sample(60_000, random_state=SEED)
for flag, m, lab in [(False, "o", "inlier"), (True, "x", "Isolation Forest outlier")]:
    d = s[s.is_outlier == flag]
    ax.scatter(d.speechiness, d.loudness, s=3 if not flag else 8, marker=m, alpha=0.35 if not flag else 0.8, label=lab)
ax.set(title="Outliers are mostly spoken-word or near-silent tracks", xlabel="Speechiness (0-1)", ylabel="Loudness (dB)")
ax.legend(markerscale=3)
theme.save(fig, "fig_02_03_isolation_forest_outliers")

# %% [markdown]
# ## 8. Save processed tables

# %%
keep = ["id", "name", "album", "album_id", "artists", "artist_main", "n_artists", "track_number", "disc_number",
        "explicit", "danceability", "energy", "key", "key_name", "loudness", "mode", "mode_name", "speechiness",
        "acousticness", "instrumentalness", "liveness", "valence", "tempo", "tempo_raw", "tempo_imputed",
        "duration_ms", "duration_min", "log_duration", "time_signature", "year", "decade", "release_date",
        "date_precision", "is_canonical", "track_genre", "iso_score", "is_outlier"] + \
       [c for c in a.columns if c.startswith("yj_")]
a[keep].to_parquet(proc / "tracks.parquet", index=False)
gt.drop(columns=["genres_all"]).assign(genres_all=gt["genres_all"].str.join(";")).to_parquet(proc / "genre_tracks.parquet", index=False)

results.save("cleaning", {
    "tempo_zero_imputed": n_missing_tempo, "time_signature_zero_imputed": n_missing_ts,
    "mice_seconds": mice_seconds, "mice_validation": val,
    "canonical_rows": int(a.is_canonical.sum()), "reissue_rows": int((~a.is_canonical).sum()),
    "join": join, "skew": {k: {"before": v[0], "after": v[1], "transform": v[2]} for k, v in skew_rows.items()},
    "iqr": iqr_counts, "iso_outliers": int(a.is_outlier.sum()), "iso_pct": 100 * float(a.is_outlier.mean()),
    "iso_seconds": iso_seconds, "outlier_examples": ex_counts,
    "iso_outlier_mean_speechiness": float(iso_profile.loc["speechiness", True]),
    "iso_inlier_mean_speechiness": float(iso_profile.loc["speechiness", False]),
    "rows_tracks": len(a), "rows_genre_tracks": len(gt),
    "genre_tracks_with_year": int(gt.year.notna().sum()),
    "date_precision": a["date_precision"].value_counts().to_dict(),
})
print("done")
