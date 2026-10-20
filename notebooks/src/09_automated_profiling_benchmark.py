# kernel: sonic-profiling
# %% [markdown]
# # 09 - Automated profiling benchmark (YData-Profiling, Sweetviz, D-Tale)
# **Goal:** run the three automated EDA tools from the course handout on the same 20,000-track sample and compare
# them with our manual EDA (what they found, what they missed, runtime, usability).
#
# This notebook runs in a separate environment (`.venv-profiling`, kernel `sonic-profiling`) because the profiling
# libraries pin older pandas versions than the main analysis environment.
#
# **Inputs:** `data/processed/tracks.parquet`. **Outputs:** `reports/profiling/*.html`, `reports/profiling/dtale_*`,
# `reports/tables/tab_09_tool_comparison.csv`, `results.json -> profiling`.

# %%
import json
import sys
import time
from pathlib import Path
import pandas as pd

ROOT = Path.cwd().parent
sys.path.insert(0, str(ROOT / "src"))
from sonicatlas import results  # noqa: E402

PROF = ROOT / "reports" / "profiling"
PROF.mkdir(parents=True, exist_ok=True)
cols = ["danceability", "energy", "loudness", "speechiness", "acousticness", "instrumentalness", "liveness", "valence",
        "tempo", "duration_min", "key_name", "mode_name", "explicit", "decade"]
a = pd.read_parquet(ROOT / "data" / "processed" / "tracks.parquet", columns=cols + ["is_canonical"])
s = a[a.is_canonical & a.decade.notna()].sample(20_000, random_state=42)[cols].reset_index(drop=True)
s["decade"] = s["decade"].astype(int)
print(pd.__version__, s.shape)

# %% [markdown]
# ## YData-Profiling

# %%
from ydata_profiling import ProfileReport
t0 = time.time()
prof = ProfileReport(s, title="SonicAtlas - YData-Profiling (20,000 tracks)", minimal=False, progress_bar=False,
                     correlations={"auto": {"calculate": True}, "pearson": {"calculate": True}, "spearman": {"calculate": True}},
                     interactions={"continuous": False})
prof.to_file(PROF / "ydata_profiling.html")
ydata_s = time.time() - t0
desc = prof.get_description()
alerts = [str(x) for x in desc.alerts]
print(round(ydata_s, 1), len(alerts))
alerts[:25]

# %% [markdown]
# ## Sweetviz: compare the 1990s with the 2010s

# %%
import sweetviz as sv
d90 = s[s.decade == 1990].drop(columns="decade")
d10 = s[s.decade == 2010].drop(columns="decade")
t0 = time.time()
rep = sv.compare([d90, "1990s"], [d10, "2010s"])
rep.show_html(str(PROF / "sweetviz_1990s_vs_2010s.html"), open_browser=False, layout="vertical")
sweet_s = time.time() - t0
print(round(sweet_s, 1), len(d90), len(d10))

# %% [markdown]
# ## D-Tale: start the server, read its summary and code export, then stop it
# D-Tale is an interactive server-based grid; we record its startup time and export its describe output.

# %%
import dtale
import dtale.global_state as gs
t0 = time.time()
d = dtale.show(s, open_browser=False, ignore_duplicate=True)  # default: server runs in a background thread
dtale_s = time.time() - t0
dt_url = d._main_url
dt_desc = d.data.describe().T
dt_desc.to_csv(PROF / "dtale_describe.csv")

d.kill()
print(round(dtale_s, 1), dt_url)

# %% [markdown]
# ## Comparison with the manual EDA

# %%
def has(words):
    return any(all(w.lower() in a_.lower() for w in words) for a_ in alerts)

found = {
    "skewed features flagged": has(["skew"]),
    "high correlation energy~loudness": has(["energy", "correlat"]) or has(["loudness", "correlat"]),
    "zeros flagged (instrumentalness)": has(["instrumentalness", "zero"]),
    "duplicates reported": has(["duplicate"]),
}
rows = [
    ["YData-Profiling", f"{ydata_s:.1f}", "static HTML report", "distributions, missing values, correlations, alerts (skew, zeros, high correlation)",
     "no domain meaning (e.g. tempo = 0 is impossible), no Tukey quartiles or G2, no time trends, no genre comparison"],
    ["Sweetviz", f"{sweet_s:.1f}", "static HTML, two-group comparison", "side-by-side 1990s vs 2010s distributions and associations",
     "no statistical test of the difference, no effect sizes, only two groups at a time"],
    ["D-Tale", f"{dtale_s:.1f}", "live server grid in the browser", "sortable grid, describe, charts and pandas code export",
     "needs a running Python server, not shareable as a static page, no music-specific views"],
    ["Manual EDA (SonicAtlas)", "minutes per notebook", "notebooks + static website", "everything above plus MICE, outlier cases, PCA/t-SNE/LLE, STL, change points, tests, lyrics",
     "takes more effort to build; requires domain knowledge"],
]
tab = pd.DataFrame(rows, columns=["Tool", "Runtime (s)", "Output", "What it found", "What it missed"])
tab.to_csv(ROOT / "reports" / "tables" / "tab_09_tool_comparison.csv", index=False)
print(found)
tab

# %%
paras = [
    f"The three automated EDA tools from the course handout were run on the same random sample of 20,000 canonical tracks. "
    f"YData-Profiling produced a full HTML report in {ydata_s:.1f} s with {len(alerts)} automatic alerts, including skewness and "
    f"high-correlation warnings that agree with Sections 4.2.2 and 4.2.4. Sweetviz compared the {len(d90):,} tracks from the 1990s with the "
    f"{len(d10):,} from the 2010s in {sweet_s:.1f} s and visibly showed the shift towards higher energy and lower acousticness. "
    f"D-Tale started an interactive grid server in {dtale_s:.1f} s and can export pandas code for each operation.",
    "None of the tools knows that a tempo of 0 BPM or a time signature of 0 is impossible, none reports Tukey quartiles or "
    "the bias-corrected kurtosis used in the course, and none performs significance tests, dimensionality reduction or "
    "time-series decomposition. They are fast first-look tools; the music-specific questions still needed the manual "
    "workflow, which is why SonicAtlas embeds the generated reports in its Data Profile page instead of relying on them alone.",
]
results.save("profiling", {
    "sample_n": len(s), "ydata_seconds": ydata_s, "ydata_alerts": len(alerts), "ydata_alert_examples": alerts[:12],
    "sweetviz_seconds": sweet_s, "sweetviz_n_1990s": len(d90), "sweetviz_n_2010s": len(d10), "dtale_seconds": dtale_s,
    "found_checks": found, "report_paragraphs": paras,
    "table": {"header": tab.columns.tolist(), "rows": tab.values.tolist(), "caption": "Automated EDA tools compared with the manual EDA"},
})
