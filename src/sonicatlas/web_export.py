"""Export compact files for the SonicAtlas website (web/public/data).

Run:  python -m sonicatlas.web_export
"""
from __future__ import annotations

import json
import shutil

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from statsmodels.tsa.seasonal import STL

from . import DATA, ROOT, SEED
from .results import load

OUT = ROOT / "web" / "public" / "data"
FEATS = ["danceability", "energy", "loudness", "speechiness", "acousticness", "instrumentalness",
         "liveness", "valence", "tempo", "duration_min"]


def _write(df: pd.DataFrame, name: str) -> int:
    tbl = pa.Table.from_pandas(df, preserve_index=False)
    p = OUT / name
    pq.write_table(tbl, p, compression="zstd", row_group_size=20_000)
    return p.stat().st_size


def tracks_lite(n: int = 150_000) -> dict:
    a = pd.read_parquet(DATA / "processed" / "tracks.parquet")
    cl = pd.read_parquet(DATA / "processed" / "track_clusters.parquet")
    a = a.merge(cl, on="id", how="left")
    canon = a[a.is_canonical & a.year.notna()]
    # keep every genre-labelled track, fill the rest with a random sample
    labelled = canon[canon.track_genre.notna()]
    rest = canon[canon.track_genre.isna()].sample(n - len(labelled), random_state=SEED)
    lite = pd.concat([labelled, rest]).sample(frac=1, random_state=SEED)
    cols = ["id", "name", "artist_main", "album", "year", "decade", "explicit", "key_name", "mode_name", "time_signature"] + FEATS + \
           ["track_genre", "cluster", "pc1", "pc2", "is_outlier"]
    lite = lite[cols].rename(columns={"artist_main": "artist", "track_genre": "genre"})
    lite["year"] = lite["year"].astype("int16")
    lite["decade"] = lite["decade"].astype("int16")
    lite["cluster"] = lite["cluster"].astype("int8")
    for c in FEATS + ["pc1", "pc2"]:
        lite[c] = lite[c].astype("float32").round(4)
    size = _write(lite, "tracks_lite.parquet")
    full = a[["id", "name", "artist_main", "album", "year", "decade", "explicit", "key_name", "mode_name"] + FEATS +
             ["track_genre", "cluster", "is_outlier", "is_canonical"]].rename(columns={"artist_main": "artist", "track_genre": "genre"})
    for c in FEATS:
        full[c] = full[c].astype("float32")
    full_path = DATA / "processed" / "tracks_full_web.parquet"
    pq.write_table(pa.Table.from_pandas(full, preserve_index=False), full_path, compression="zstd")
    return {"lite_rows": len(lite), "lite_bytes": size, "lite_labelled": len(labelled), "full_rows": len(full),
            "full_bytes": full_path.stat().st_size}


def genre_table() -> dict:
    g = pd.read_parquet(DATA / "processed" / "genre_tracks.parquet")
    cols = ["track_id", "track_name", "artist_main", "album_name", "track_genre", "popularity", "explicit", "key_name", "mode_name"] + FEATS + ["year"]
    g = g[cols].rename(columns={"track_id": "id", "track_name": "name", "artist_main": "artist", "album_name": "album", "track_genre": "genre"})
    for c in FEATS:
        g[c] = g[c].astype("float32").round(4)
    return {"genre_rows": len(g), "genre_bytes": _write(g, "genre_tracks.parquet")}


def embeddings() -> dict:
    e = pd.read_parquet(DATA / "processed" / "embeddings_genre_sample.parquet")
    e = e.rename(columns={"track_id": "id", "track_name": "name", "artist_main": "artist", "track_genre": "genre"})
    for c in e.columns:
        if e[c].dtype.kind == "f":
            e[c] = e[c].astype("float32").round(4)
    return {"embed_rows": len(e), "embed_bytes": _write(e, "embeddings.parquet")}


def timeseries() -> dict:
    y = pd.read_parquet(DATA / "processed" / "yearly_means.parquet").reset_index()
    a = pd.read_parquet(DATA / "processed" / "tracks.parquet", columns=["release_date", "date_precision", "is_canonical"] + FEATS)
    d = a[a.is_canonical & (a.date_precision == "day")]
    d = d[~((d.release_date.dt.month == 1) & (d.release_date.dt.day == 1)) & d.release_date.dt.year.between(1990, 2020)]
    m = d.set_index("release_date").resample("MS")[FEATS].mean().dropna()
    stl = {}
    for c in FEATS:
        r = STL(m[c], period=12, robust=True).fit()
        stl[c] = {"observed": m[c].round(5).tolist(), "trend": r.trend.round(5).tolist(), "seasonal": r.seasonal.round(5).tolist()}
    res = load()["timeseries"]
    out = {"years": y["year"].astype(int).tolist(), "yearly": {c: y[c].round(5).tolist() for c in FEATS if c in y.columns},
           "n_tracks": y["n_tracks"].astype(int).tolist(), "months": [t.strftime("%Y-%m") for t in m.index], "stl": stl,
           "change_points": res["change_points"], "decade_means": res["decade_means"]}
    (OUT / "timeseries.json").write_text(json.dumps(out))
    return {"ts_bytes": (OUT / "timeseries.json").stat().st_size}


def summary() -> dict:
    r = load()
    keep = {k: r[k] for k in ["audit", "cleaning", "descriptive", "multivariate", "dimred", "timeseries", "tests", "lyrics", "network", "profiling"] if k in r}
    # trim bulky parts
    keep.get("multivariate", {}).pop("spearman", None)
    (OUT / "summary.json").write_text(json.dumps(keep))
    lit = ROOT / "docs_build" / "literature.json"
    if lit.exists():
        shutil.copy(lit, OUT / "literature.json")
    for extra in ["lyrics_web.json", "network.json"]:
        p = DATA / "processed" / extra
        if p.exists():
            shutil.copy(p, OUT / extra)
    return {"summary_bytes": (OUT / "summary.json").stat().st_size}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    info = {}
    for fn in (tracks_lite, genre_table, embeddings, timeseries, summary):
        info.update(fn())
        print(fn.__name__, "done", flush=True)
    (OUT / "manifest.json").write_text(json.dumps(info, indent=1))
    from .results import save
    save("web_data", info)
    print(info)


if __name__ == "__main__":
    main()
