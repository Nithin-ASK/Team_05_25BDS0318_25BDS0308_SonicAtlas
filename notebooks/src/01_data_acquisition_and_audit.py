# %% [markdown]
# # 01 - Data acquisition and audit
# **Goal:** load the raw public datasets and audit them (shape, types, missing values, duplicates, impossible values).
#
# **Inputs:** `data/raw/spotify_12m/tracks_features.csv` (Kaggle *rodolfofigueroa/spotify-12m-songs*),
# `data/raw/spotify_tracks_114k/dataset.csv` (Kaggle *maharshipandya/-spotify-tracks-dataset*).
#
# **Outputs:** `reports/tables/audit_*.csv`, `results.json -> audit`, `data/interim/*.parquet` (typed copies of raw data).

# %%
import hashlib
import pandas as pd
import numpy as np
from sonicatlas import DATA, TAB, results

raw = DATA / "raw"
a = pd.read_csv(raw / "spotify_12m" / "tracks_features.csv")
g = pd.read_csv(raw / "spotify_tracks_114k" / "dataset.csv", index_col=0)
print(a.shape, g.shape)

# %% [markdown]
# ## Checksums of the raw files (raw data is never edited)

# %%
lines = []
for p in sorted(raw.rglob("*.csv")):
    h = hashlib.sha256(p.read_bytes()).hexdigest()
    lines.append(f"{h}  {p.relative_to(DATA).as_posix()}")
(DATA / "CHECKSUMS.txt").write_text("\n".join(lines) + "\n")
print("\n".join(lines))

# %% [markdown]
# ## Column types and missing values

# %%
def audit(df, name):
    t = pd.DataFrame({"dtype": df.dtypes.astype(str), "missing": df.isna().sum(),
                      "missing_pct": (df.isna().mean() * 100).round(4), "unique": df.nunique()})
    t.to_csv(TAB / f"audit_{name}.csv")
    return t

TAB.mkdir(parents=True, exist_ok=True)
audit(a, "spotify_12m")

# %%
audit(g, "spotify_tracks_114k")

# %% [markdown]
# ## Duplicates and impossible values

# %%
def norm(s):
    return s.astype(str).str.lower().str.replace(r"[^a-z0-9 ]", "", regex=True).str.strip()

a_dup_id = int(a["id"].duplicated().sum())
a_key = norm(a["name"]) + "|" + norm(a["artists"])
a_dup_title_artist = int(a_key.duplicated().sum())
g_dup_id = int(g["track_id"].duplicated().sum())
g_key = norm(g["track_name"]) + "|" + norm(g["artists"])
g_dup_title_artist = int(g_key.duplicated().sum())

checks = {
    "tempo_zero": int((a.tempo == 0).sum()),
    "time_signature_zero": int((a.time_signature == 0).sum()),
    "loudness_positive": int((a.loudness > 0).sum()),
    "year_zero_or_before_1900": int((a.year < 1900).sum()),
    "duration_under_30s": int((a.duration_ms < 30_000).sum()),
    "duration_over_20min": int((a.duration_ms > 20 * 60_000).sum()),
}
g_checks = {"tempo_zero": int((g.tempo == 0).sum()), "time_signature_zero": int((g.time_signature == 0).sum()),
            "duration_under_30s": int((g.duration_ms < 30_000).sum()), "popularity_zero": int((g.popularity == 0).sum())}
print(a_dup_id, a_dup_title_artist, g_dup_id, g_dup_title_artist)
print(checks, g_checks)

# %%
results.save("audit", {
    "a_rows": len(a), "a_cols": a.shape[1], "g_rows": len(g), "g_cols": g.shape[1],
    "a_missing_total": int(a.isna().sum().sum()),
    "a_missing_by_col": {k: int(v) for k, v in a.isna().sum().items() if v},
    "g_missing_total": int(g.isna().sum().sum()),
    "g_missing_by_col": {k: int(v) for k, v in g.isna().sum().items() if v},
    "a_dup_id": a_dup_id, "a_dup_title_artist": a_dup_title_artist,
    "g_dup_id": g_dup_id, "g_dup_title_artist": g_dup_title_artist,
    "a_checks": checks, "g_checks": g_checks,
    "a_year_min": int(a.loc[a.year >= 1900, "year"].min()), "a_year_max": int(a.year.max()),
    "g_genres": int(g.track_genre.nunique()),
})

# %% [markdown]
# ## Save typed interim copies (fast Parquet) for the next notebooks

# %%
(DATA / "interim").mkdir(exist_ok=True)
a.to_parquet(DATA / "interim" / "spotify_12m.parquet", index=False)
g.to_parquet(DATA / "interim" / "spotify_tracks_114k.parquet", index=False)
print("saved")
