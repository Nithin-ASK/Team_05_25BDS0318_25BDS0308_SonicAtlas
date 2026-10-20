# %% [markdown]
# # 05 - Dimensionality reduction (PCA, SVD, t-SNE, LLE) and clustering
# **Goal:** map the 10-dimensional audio space to 2-D/3-D, compare methods (runtime, trustworthiness, silhouette),
# and find named acoustic clusters with KMeans and HDBSCAN.
#
# **Inputs:** `data/processed/tracks.parquet`, `data/processed/genre_tracks.parquet`.
#
# **Outputs:** figures `fig_05_*`, `reports/tables/tab_05_*.csv`, `data/processed/embeddings_genre_sample.parquet`,
# `data/processed/track_clusters.parquet`, `results.json -> dimred`.

# %%
import time
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE, LocallyLinearEmbedding, trustworthiness
from sklearn.cluster import KMeans, HDBSCAN
from sklearn.metrics import silhouette_score
from sonicatlas import DATA, TAB, SEED, results, theme

theme.apply()
a = pd.read_parquet(DATA / "processed" / "tracks.parquet")
gt = pd.read_parquet(DATA / "processed" / "genre_tracks.parquet")
gt["log_duration"] = np.log1p(gt["duration_min"])
FEATS = ["danceability", "energy", "loudness", "speechiness", "acousticness", "instrumentalness",
         "liveness", "valence", "tempo", "log_duration"]
FOCUS = ["classical", "jazz", "country", "rock", "metal", "hip-hop", "edm", "pop"]

# %% [markdown]
# ## PCA on all 1.2M tracks (standardised features)

# %%
scaler = StandardScaler().fit(a[FEATS])
Z = scaler.transform(a[FEATS])
t0 = time.time()
pca = PCA(random_state=SEED).fit(Z)
pca_seconds = time.time() - t0
evr = pca.explained_variance_ratio_
cum = np.cumsum(evr)
n90 = int(np.searchsorted(cum, 0.90) + 1)
loadings = pd.DataFrame(pca.components_[:3].T, index=FEATS, columns=["PC1", "PC2", "PC3"])
loadings.to_csv(TAB / "tab_05_01_pca_loadings.csv")
print(np.round(evr, 4), n90)
loadings.round(3)

# %% [markdown]
# ### SVD link: PCA = SVD of the centred data matrix (eigenvalues = s^2 / (n-1))

# %%
sub = Z[np.random.default_rng(SEED).choice(len(Z), 50_000, replace=False)]
sub = sub - sub.mean(0)
U, S, Vt = np.linalg.svd(sub, full_matrices=False)
svd_evr = S ** 2 / (S ** 2).sum()
pca_sub = PCA().fit(sub)
svd_match = bool(np.allclose(svd_evr, pca_sub.explained_variance_ratio_, atol=1e-10))
print("SVD explained variance equals PCA:", svd_match, np.round(svd_evr[:3], 4))

# %%
fig, ax = plt.subplots(1, 2, figsize=(13, 4.4))
ax[0].bar(range(1, 11), evr * 100, color=theme.OKABE_ITO[0], edgecolor="k", lw=0.4, label="per component")
ax[0].plot(range(1, 11), cum * 100, color="k", marker="o", ls="--", label="cumulative")
ax[0].axhline(90, color=theme.OKABE_ITO[3], ls=":", lw=1)
ax[0].set(title=f"PC1-PC2 explain {cum[1] * 100:.1f}%; {n90} PCs reach 90%", xlabel="Principal component", ylabel="Explained variance (%)")
ax[0].legend()
ps = pca.transform(Z[np.random.default_rng(SEED).choice(len(Z), 8000, replace=False)])
ax[1].scatter(ps[:, 0], ps[:, 1], s=2, alpha=0.25, color="grey")
for i, f in enumerate(FEATS):
    ax[1].arrow(0, 0, loadings.iloc[i, 0] * 4, loadings.iloc[i, 1] * 4, color=theme.OKABE_ITO[3], width=0.02, head_width=0.12)
    ax[1].text(loadings.iloc[i, 0] * 4.5, loadings.iloc[i, 1] * 4.5, f, fontsize=8, ha="center")
ax[1].set(title="Biplot: PC1 = loud/energetic vs acoustic; PC2 = long/instrumental vs danceable/wordy", xlabel="PC1", ylabel="PC2")
fig.tight_layout()
theme.save(fig, "fig_05_01_pca_scree_biplot")

# %% [markdown]
# ## Stratified sample for t-SNE and LLE
# Up to 90 tracks from each of the 114 genres (10,000 tracks) so every genre is represented.

# %%
per = 90  # smallest genre has fewer tracks, so it contributes all of them
shuf = gt.sample(frac=1, random_state=SEED)
samp = shuf[shuf.groupby("track_genre").cumcount() < per].sample(10_000, random_state=SEED).reset_index(drop=True)
Xs = scaler.transform(samp[FEATS])
emb, runtime = {}, {}
t0 = time.time(); emb["PCA"] = pca.transform(Xs)[:, :2]; runtime["PCA"] = time.time() - t0
t0 = time.time(); emb["t-SNE"] = TSNE(2, perplexity=30, init="pca", random_state=SEED).fit_transform(Xs); runtime["t-SNE"] = time.time() - t0
t0 = time.time(); emb["LLE"] = LocallyLinearEmbedding(n_neighbors=15, n_components=2, random_state=SEED).fit_transform(Xs); runtime["LLE"] = time.time() - t0
print(runtime)

# %%
try:
    import umap
    t0 = time.time(); emb["UMAP"] = umap.UMAP(random_state=SEED).fit_transform(Xs); runtime["UMAP"] = time.time() - t0
except ImportError:
    print("umap-learn not installed - UMAP bonus skipped")

# %%
rng = np.random.default_rng(SEED)
tw_idx = rng.choice(len(Xs), 3000, replace=False)
focus_mask = samp.track_genre.isin(FOCUS).to_numpy()
cmp_rows = {}
for m, E in emb.items():
    cmp_rows[m] = {"runtime_s": runtime[m],
                   "trustworthiness_k10": trustworthiness(Xs[tw_idx], E[tw_idx], n_neighbors=10),
                   "silhouette_focus_genres": silhouette_score(E[focus_mask], samp.track_genre[focus_mask])}
cmp_rows["Original 10-D"] = {"runtime_s": 0.0, "trustworthiness_k10": 1.0,
                             "silhouette_focus_genres": silhouette_score(Xs[focus_mask], samp.track_genre[focus_mask])}
cmp = pd.DataFrame(cmp_rows).T
cmp.to_csv(TAB / "tab_05_02_method_comparison.csv")
cmp.round(3)

# %%
fig, axes = plt.subplots(1, len(emb), figsize=(5 * len(emb), 4.6))
for ax, (m, E) in zip(axes, emb.items()):
    ax.scatter(E[~focus_mask, 0], E[~focus_mask, 1], s=2, color="#cccccc", alpha=0.5, label="other genres")
    for i, gname in enumerate(FOCUS):
        k = (samp.track_genre == gname).to_numpy()
        ax.scatter(E[k, 0], E[k, 1], s=9, color=theme.OKABE_ITO[i], marker=theme.MARKERS[i], label=gname, alpha=0.85)
    ax.set(title=f"{m} (trust={cmp.loc[m, 'trustworthiness_k10']:.2f})", xticks=[], yticks=[])
axes[0].legend(ncol=1, fontsize=7, markerscale=1.6, loc="best")
fig.suptitle("t-SNE preserves local neighbourhoods best; genres overlap in every 2-D map", fontweight="bold")
fig.tight_layout()
theme.save(fig, "fig_05_02_tsne_lle_pca_maps")

# %% [markdown]
# ## Decade-coloured t-SNE (1.2M table, stratified by decade, canonical releases)

# %%
dec = a[a.is_canonical & a.decade.between(1950, 2010)]
dsamp = dec.groupby("decade").sample(1000, random_state=SEED).reset_index(drop=True)
Ed = TSNE(2, perplexity=30, init="pca", random_state=SEED).fit_transform(scaler.transform(dsamp[FEATS]))
fig, ax = plt.subplots(figsize=(7.5, 6))
for i, d in enumerate(sorted(dsamp.decade.unique())):
    k = (dsamp.decade == d).to_numpy()
    ax.scatter(Ed[k, 0], Ed[k, 1], s=6, color=theme.OKABE_ITO[i], marker=theme.MARKERS[i], label=f"{int(d)}s", alpha=0.7)
dec_sil = float(silhouette_score(Ed, dsamp.decade))
ax.set(title=f"Decades overlap on the t-SNE map (silhouette = {dec_sil:.2f}); 1950s-60s lean acoustic", xticks=[], yticks=[])
ax.legend(markerscale=2, ncol=2)
theme.save(fig, "fig_05_03_tsne_by_decade")

# %% [markdown]
# ## Clustering on PCA space: choose k by elbow and silhouette

# %%
P = pca.transform(Z)[:, :n90]
cl_idx = rng.choice(len(P), 30_000, replace=False)
ks = list(range(2, 11))
inertia, sil = [], []
for k in ks:
    km = KMeans(k, n_init=5, random_state=SEED).fit(P[cl_idx])
    inertia.append(km.inertia_)
    sil.append(silhouette_score(P[cl_idx], km.labels_, sample_size=10_000, random_state=SEED))
best_k = ks[int(np.argmax(sil))]
# k = 2 only splits "acoustic" from "electric"; k = 6 is the next silhouette plateau and gives nameable groups
k_used = best_k if best_k >= 4 else 6
fig, ax = plt.subplots(1, 2, figsize=(11, 3.6))
ax[0].plot(ks, inertia, marker="o", color=theme.OKABE_ITO[0]); ax[0].set(title="Elbow (inertia)", xlabel="k", ylabel="Within-cluster SS")
ax[1].plot(ks, sil, marker="s", color=theme.OKABE_ITO[3], ls="--"); ax[1].set(title=f"Silhouette peaks at k = {best_k}; k = {k_used} used for named groups", xlabel="k", ylabel="Silhouette")
for x in (ax[0], ax[1]):
    x.axvline(k_used, color="grey", ls=":")
fig.tight_layout()
theme.save(fig, "fig_05_04_kmeans_elbow_silhouette")
print(best_k, k_used, np.round(sil, 3))

# %%
km = KMeans(k_used, n_init=10, random_state=SEED).fit(P[cl_idx])
a["cluster"] = km.predict(P)
cent = a.groupby("cluster")[FEATS].mean()
gt["cluster"] = km.predict(pca.transform(scaler.transform(gt[FEATS]))[:, :n90])
top_genres = gt.groupby("cluster")["track_genre"].agg(lambda s: ", ".join(s.value_counts().head(3).index))

def name_cluster(c):
    if c.speechiness > 0.3:
        return "Spoken word & rap"
    if c.instrumentalness > 0.5 and c.acousticness > 0.6:
        return "Quiet acoustic instrumentals"
    if c.instrumentalness > 0.5:
        return "Electronic / instrumental grooves"
    if c.liveness > 0.5:
        return "Live recordings"
    if c.acousticness > 0.6:
        return "Soft acoustic songs"
    if c.energy > 0.7 and c.valence < 0.4:
        return "Loud & intense (rock/metal)"
    if c.danceability > 0.6 and c.valence > 0.55:
        return "Upbeat danceable pop"
    if c.energy > 0.6:
        return "Energetic mainstream"
    return "Mid-tempo mixed"

names = {c: name_cluster(cent.loc[c]) for c in cent.index}
seen = {}
for c, nm in names.items():
    seen[nm] = seen.get(nm, 0) + 1
    if seen[nm] > 1:
        names[c] = f"{nm} ({seen[nm]})"
ctab = cent.round(3).assign(size=a.cluster.value_counts().sort_index(), share_pct=(a.cluster.value_counts(normalize=True).sort_index() * 100).round(1),
                           top_genres=top_genres, name=pd.Series(names))
ctab.to_csv(TAB / "tab_05_03_cluster_profiles.csv")
ctab[["name", "size", "share_pct", "top_genres", "danceability", "energy", "acousticness", "instrumentalness", "speechiness", "valence"]]

# %%
hdb = HDBSCAN(min_cluster_size=300, min_samples=20).fit(P[cl_idx[:20_000]])
hdb_n = int(len(set(hdb.labels_)) - (1 if -1 in hdb.labels_ else 0))
hdb_noise = float((hdb.labels_ == -1).mean() * 100)
print("HDBSCAN clusters:", hdb_n, "noise %:", round(hdb_noise, 1))

# %%
samp["cluster"] = km.predict(pca.transform(Xs)[:, :n90])
fig, ax = plt.subplots(figsize=(8, 6.5))
E = emb["t-SNE"]
for i in sorted(samp.cluster.unique()):
    k = (samp.cluster == i).to_numpy()
    ax.scatter(E[k, 0], E[k, 1], s=5, color=theme.OKABE_ITO[i % 8], marker=theme.MARKERS[i % 8], label=names[i], alpha=0.7)
ax.set(title=f"KMeans (k = {k_used}) acoustic clusters on the t-SNE map", xticks=[], yticks=[])
ax.legend(markerscale=2.5, fontsize=8, loc="best")
theme.save(fig, "fig_05_05_clusters_on_tsne")

# %%
out = samp[["track_id", "track_name", "artist_main", "track_genre", "popularity", "cluster"] + FEATS].copy()
for m, E in emb.items():
    out[f"{m.lower().replace('-', '')}_x"] = E[:, 0]; out[f"{m.lower().replace('-', '')}_y"] = E[:, 1]
out.to_parquet(DATA / "processed" / "embeddings_genre_sample.parquet", index=False)
pc = pca.transform(Z)[:, :3]
pd.DataFrame({"id": a["id"], "cluster": a["cluster"], "pc1": pc[:, 0], "pc2": pc[:, 1], "pc3": pc[:, 2]}).to_parquet(DATA / "processed" / "track_clusters.parquet", index=False)

results.save("dimred", {
    "evr": evr.tolist(), "cum": cum.tolist(), "n90": n90, "pca_seconds": pca_seconds,
    "loadings": loadings.to_dict(), "svd_match": svd_match,
    "sample_size": len(samp), "per_genre": per, "comparison": cmp.to_dict(orient="index"),
    "decade_tsne_silhouette": dec_sil, "k_range": ks, "silhouette_by_k": sil, "inertia_by_k": inertia,
    "best_k": best_k, "k_used": k_used,
    "clusters": {int(c): {"name": names[c], "size": int(ctab.loc[c, "size"]), "share_pct": float(ctab.loc[c, "share_pct"]),
                          "top_genres": top_genres.get(c, ""), **{f: float(cent.loc[c, f]) for f in FEATS}} for c in cent.index},
    "hdbscan_clusters": hdb_n, "hdbscan_noise_pct": hdb_noise, "hdbscan_n": 20_000,
})
