# %% [markdown]
# # 10 - Artist collaboration network
# **Goal:** build a graph where artists are nodes and shared tracks are edges; compute degree, betweenness and
# Louvain communities; draw a static figure and export an interactive subgraph for the website.
#
# **Inputs:** `data/processed/tracks.parquet` (artists list per track, canonical releases).
#
# **Outputs:** figure `fig_10_01_*`, `reports/tables/tab_10_*.csv`, `data/processed/network.json`, `results.json -> network`.

# %%
import ast
import itertools
import json
from collections import Counter
import numpy as np
import pandas as pd
import networkx as nx
import matplotlib.pyplot as plt
from sonicatlas import DATA, TAB, SEED, results, theme

theme.apply()
a = pd.read_parquet(DATA / "processed" / "tracks.parquet",
                    columns=["artists", "n_artists", "is_canonical", "energy", "danceability", "acousticness", "valence", "year"])
multi = a[a.is_canonical & (a.n_artists >= 2)].copy()
multi["artists_list"] = multi["artists"].map(ast.literal_eval)
print(len(a), "tracks;", len(multi), "canonical collaborations")

# %%
edges = Counter()
for arts in multi["artists_list"]:
    for u, v in itertools.combinations(sorted(set(arts)), 2):
        edges[(u, v)] += 1
G = nx.Graph()
G.add_weighted_edges_from((u, v, w) for (u, v), w in edges.items())
comps = list(nx.connected_components(G))
giant = G.subgraph(max(comps, key=len)).copy()
print(G.number_of_nodes(), G.number_of_edges(), len(comps), giant.number_of_nodes())

# %% [markdown]
# ## Centrality (betweenness approximated with 1,000 sampled sources) and Louvain communities

# %%
deg = dict(G.degree())
wdeg = dict(G.degree(weight="weight"))
btw = nx.betweenness_centrality(giant, k=min(1000, giant.number_of_nodes()), seed=SEED)
comm = nx.community.louvain_communities(giant, weight="weight", seed=SEED, resolution=1.0)
modularity = nx.community.modularity(giant, comm, weight="weight")
cmap = {n: i for i, c in enumerate(sorted(comm, key=len, reverse=True)) for n in c}
top = pd.DataFrame({"artist": list(deg), "degree": [deg[n] for n in deg], "collab_tracks": [wdeg[n] for n in deg],
                    "betweenness": [btw.get(n, 0.0) for n in deg], "community": [cmap.get(n, -1) for n in deg]})
top.sort_values("degree", ascending=False).head(20).to_csv(TAB / "tab_10_01_top_artists_degree.csv", index=False)
top.sort_values("betweenness", ascending=False).head(20).to_csv(TAB / "tab_10_02_top_artists_betweenness.csv", index=False)
print(len(comm), round(modularity, 3))
top.sort_values("degree", ascending=False).head(10)

# %%
top.sort_values("betweenness", ascending=False).head(10)

# %% [markdown]
# ## Subgraph of the 300 most connected artists (static figure and website export)

# %%
keep = top.sort_values("degree", ascending=False).head(300)["artist"].tolist()
H = G.subgraph(keep).copy()
H = H.subgraph(max(nx.connected_components(H), key=len)).copy()  # largest connected piece only
pos = nx.spring_layout(H, seed=SEED, k=2.5 / np.sqrt(H.number_of_nodes()), iterations=200, weight=None)
fig, ax = plt.subplots(figsize=(11, 9))
comms_h = sorted({cmap.get(n, -1) for n in H}, key=lambda c: -sum(1 for n in H if cmap.get(n, -1) == c))
colour = {c: theme.OKABE_ITO[i % 8] for i, c in enumerate(comms_h)}
nx.draw_networkx_edges(H, pos, ax=ax, alpha=0.15, width=0.5)
for i, c in enumerate(comms_h[:8]):
    nodes = [n for n in H if cmap.get(n, -1) == c]
    nx.draw_networkx_nodes(H, pos, nodelist=nodes, node_size=[12 + 2.2 * np.sqrt(deg[n]) for n in nodes], node_color=colour[c],
                           node_shape="os^Dvph8"[i], ax=ax, alpha=0.85, label=f"community {c}")
other = [n for n in H if cmap.get(n, -1) not in comms_h[:8]]
nx.draw_networkx_nodes(H, pos, nodelist=other, node_size=10, node_color="#bbbbbb", ax=ax)
lab = {n: n for n in top[top.artist.isin(list(H))].sort_values("degree", ascending=False).head(10)["artist"]}
nx.draw_networkx_labels(H, pos, labels=lab, font_size=7, ax=ax, bbox=dict(fc="white", ec="none", alpha=0.7, pad=0.5))
ax.set_title(f"Most connected artists ({H.number_of_nodes()} in the largest component): {len(comm)} Louvain communities (modularity {modularity:.2f})")
ax.axis("off"); ax.legend(fontsize=8, markerscale=1.0, loc="upper left", bbox_to_anchor=(1.0, 1.0))
theme.save(fig, "fig_10_01_collaboration_network")

# %%
feat = multi.explode("artists_list").groupby("artists_list")[["energy", "danceability", "acousticness", "valence"]].mean()
nodes = [{"id": n, "degree": int(deg[n]), "tracks": int(wdeg[n]), "betweenness": round(float(btw.get(n, 0)), 6), "community": int(cmap.get(n, -1)),
          "x": round(float(pos[n][0]), 4), "y": round(float(pos[n][1]), 4),
          **{k: round(float(feat.loc[n, k]), 3) for k in feat.columns if n in feat.index}} for n in H]
links = [{"source": u, "target": v, "weight": int(d["weight"])} for u, v, d in H.edges(data=True)]
(DATA / "processed" / "network.json").write_text(json.dumps({"nodes": nodes, "links": links}))

t10d = top.sort_values("degree", ascending=False).head(5)
t10b = top.sort_values("betweenness", ascending=False).head(5)
results.save("network", {
    "collab_tracks": len(multi), "nodes": G.number_of_nodes(), "edges": G.number_of_edges(), "components": len(comps),
    "giant_nodes": giant.number_of_nodes(), "giant_share_pct": 100 * giant.number_of_nodes() / G.number_of_nodes(),
    "communities": len(comm), "modularity": modularity, "density": nx.density(G),
    "top_degree": t10d[["artist", "degree"]].values.tolist(), "top_betweenness": t10b[["artist", "betweenness"]].values.tolist(),
    "web_nodes": len(nodes), "web_links": len(links), "betweenness_samples": min(1000, giant.number_of_nodes()),
})
