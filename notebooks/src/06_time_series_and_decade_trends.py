# %% [markdown]
# # 06 - Time series and decade trends
# **Goal:** trace how audio features moved by release year: yearly means, rolling means, STL trend + seasonality
# (by release month), change points (ruptures) and a simple ARIMA forecast with an honest hold-out error.
#
# **Inputs:** `data/processed/tracks.parquet` (canonical releases only, so re-issues do not count twice).
#
# **Outputs:** figures `fig_06_*`, `reports/tables/tab_06_*.csv`, `data/processed/yearly_means.parquet`,
# `results.json -> timeseries`.

# %%
import warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import ruptures as rpt
from statsmodels.tsa.seasonal import STL
from statsmodels.tsa.arima.model import ARIMA
from sonicatlas import DATA, TAB, results, theme

warnings.filterwarnings("ignore")
theme.apply()
a = pd.read_parquet(DATA / "processed" / "tracks.parquet")
c = a[a.is_canonical & a.year.notna()].copy()
F = ["danceability", "energy", "loudness", "acousticness", "valence", "speechiness", "tempo", "duration_min"]

# %% [markdown]
# ## Tracks per year - keep years with at least 500 canonical tracks

# %%
cnt = c.groupby("year").size()
years_ok = cnt[cnt >= 500].index
y0, y1 = int(years_ok.min()), int(years_ok.max())
print(y0, y1, len(years_ok))
yearly = c[c.year.between(y0, y1)].groupby("year")[F].mean()
yearly["n_tracks"] = cnt.loc[yearly.index]
yearly.to_parquet(DATA / "processed" / "yearly_means.parquet")
yearly.round(3).to_csv(TAB / "tab_06_01_yearly_means.csv")
fig, ax = plt.subplots(figsize=(10, 3.2))
ax.bar(cnt.index, cnt.values / 1000, color=theme.OKABE_ITO[5], width=0.9)
ax.axvspan(y0, y1, color="grey", alpha=0.12, label=f"analysis window {y0}-{y1} (>= 500 tracks/year)")
ax.set(title="The catalogue is dominated by recent releases", xlabel="Release year", ylabel="Canonical tracks (thousands)")
ax.legend()
theme.save(fig, "fig_06_01_tracks_per_year")

# %% [markdown]
# ## Yearly trends with 5-year rolling means

# %%
fig, axes = plt.subplots(2, 3, figsize=(15, 7))
for i, (ax, f) in enumerate(zip(axes.ravel(), ["danceability", "energy", "loudness", "acousticness", "valence", "duration_min"])):
    ax.plot(yearly.index, yearly[f], color=theme.OKABE_ITO[i], marker=theme.MARKERS[i], ms=3, lw=0.8, alpha=0.6, label="yearly mean")
    ax.plot(yearly.index, yearly[f].rolling(5, center=True).mean(), color="k", lw=2, ls="--", label="5-year rolling mean")
    ax.set(title=f"{f}: {yearly[f].iloc[0]:.2f} ({y0}) -> {yearly[f].iloc[-1]:.2f} ({y1})", xlabel="Release year",
           ylabel={"loudness": "dB", "duration_min": "minutes"}.get(f, "mean (0-1)"))
axes[0, 0].legend(fontsize=8)
fig.suptitle("Music got louder, more energetic, more danceable and less acoustic between 1959 and 2020", fontweight="bold")
fig.tight_layout()
theme.save(fig, "fig_06_02_yearly_trends_rolling")

# %% [markdown]
# ## Change-point detection (ruptures, PELT with RBF cost)

# %%
cps = {}
for f in ["loudness", "energy", "acousticness", "danceability"]:
    sig = yearly[f].to_numpy()
    sig = (sig - sig.mean()) / sig.std()
    bk = rpt.Pelt(model="rbf", min_size=5).fit(sig).predict(pen=3)
    cps[f] = [int(yearly.index[b - 1]) + 1 for b in bk[:-1]]
print(cps)
fig, axes = plt.subplots(1, 2, figsize=(13, 3.8))
for ax, f, i in [(axes[0], "loudness", 2), (axes[1], "acousticness", 3)]:
    ax.plot(yearly.index, yearly[f], color=theme.OKABE_ITO[i], marker="o", ms=3)
    for b in cps[f]:
        ax.axvline(b, color="k", ls="--", lw=1)
    ax.set(title=f"{f.capitalize()} change points: {', '.join(map(str, cps[f])) or 'none'}", xlabel="Release year",
           ylabel="Mean loudness (dB)" if f == "loudness" else "Mean acousticness (0-1)")
fig.tight_layout()
theme.save(fig, "fig_06_03_change_points")

# %% [markdown]
# ## STL decomposition by release month (seasonality)
# Only day-precision dates are used, and 1 January dates are excluded because many labels use 1 January as a
# placeholder when only the year is known.

# %%
d = c[(c.date_precision == "day") & c.release_date.notna()].copy()
jan1_share = float(((d.release_date.dt.month == 1) & (d.release_date.dt.day == 1)).mean() * 100)
d = d[~((d.release_date.dt.month == 1) & (d.release_date.dt.day == 1))]
d = d[d.release_date.dt.year.between(1990, 2020)]
monthly = d.set_index("release_date").resample("MS")[["energy", "valence", "loudness"]].mean().dropna()
stl_res = {}
fig, axes = plt.subplots(3, 1, figsize=(11, 7), sharex=True)
st = STL(monthly["valence"], period=12, robust=True).fit()
axes[0].plot(monthly.index, monthly["valence"], color=theme.OKABE_ITO[0], lw=0.8); axes[0].set(ylabel="observed")
axes[1].plot(st.trend.index, st.trend, color="k", lw=2); axes[1].set(ylabel="trend")
axes[2].plot(st.seasonal.index, st.seasonal, color=theme.OKABE_ITO[3], lw=0.8, ls="-"); axes[2].set(ylabel="seasonal", xlabel="Release month")
seas_profile = st.seasonal.groupby(st.seasonal.index.month).mean()
for f in ["energy", "valence", "loudness"]:
    r = STL(monthly[f], period=12, robust=True).fit()
    var_s = np.var(r.seasonal); var_r = np.var(r.resid)
    stl_res[f] = {"seasonal_strength": float(max(0, 1 - var_r / (var_s + var_r))),
                  "peak_month": int(r.seasonal.groupby(r.seasonal.index.month).mean().idxmax()),
                  "low_month": int(r.seasonal.groupby(r.seasonal.index.month).mean().idxmin())}
fig.suptitle(f"STL of monthly mean valence (1990-2020): seasonal strength = {stl_res['valence']['seasonal_strength']:.2f}", fontweight="bold")
fig.tight_layout()
theme.save(fig, "fig_06_04_stl_valence_monthly")
print(jan1_share, stl_res)

# %% [markdown]
# ## Simple forecast: ARIMA(1,1,1) on yearly loudness, trained to 2010, tested on 2011-2020

# %%
s = yearly["loudness"]
train, test = s[s.index <= 2010], s[s.index > 2010]
model = ARIMA(train.to_numpy(), order=(1, 1, 1)).fit()
fc = model.get_forecast(len(test))
pred, ci = fc.predicted_mean, fc.conf_int(alpha=0.05)
mae = float(np.mean(np.abs(pred - test.to_numpy())))
mae_naive = float(np.mean(np.abs(train.iloc[-1] - test.to_numpy())))
fig, ax = plt.subplots(figsize=(10, 3.6))
ax.plot(train.index, train, color=theme.OKABE_ITO[0], label="train")
ax.plot(test.index, test, color="k", marker="o", label="actual (held out)")
ax.plot(test.index, pred, color=theme.OKABE_ITO[3], ls="--", marker="s", label="ARIMA(1,1,1) forecast")
ax.fill_between(test.index, ci[:, 0], ci[:, 1], color=theme.OKABE_ITO[3], alpha=0.15, label="95% interval")
ax.set(title=f"Forecast MAE = {mae:.2f} dB vs naive (last value) {mae_naive:.2f} dB", xlabel="Release year", ylabel="Mean loudness (dB)")
ax.legend(fontsize=8)
theme.save(fig, "fig_06_05_arima_loudness_forecast")

# %% [markdown]
# ## Decade story

# %%
dec = c[c.decade.between(1950, 2020)].groupby("decade")[F].mean()
dec["n"] = c[c.decade.between(1950, 2020)].groupby("decade").size()
dec.round(3).to_csv(TAB / "tab_06_02_decade_means.csv")
dec.round(3)

# %%
fig, ax = plt.subplots(figsize=(10, 4.2))
for i, f in enumerate(["danceability", "energy", "acousticness", "valence"]):
    ax.plot(dec.index.astype(int), dec[f], color=theme.OKABE_ITO[i], marker=theme.MARKERS[i], ls=theme.LINESTYLES[i], lw=2, label=f)
ax.set(title="Decade means: acousticness fell while energy and danceability climbed", xlabel="Decade", ylabel="Mean value (0-1)")
ax.legend(ncol=4)
theme.save(fig, "fig_06_06_decade_story")

# %%
corr_year = {f: float(np.corrcoef(yearly.index, yearly[f])[0, 1]) for f in F}
results.save("timeseries", {
    "year_window": [y0, y1], "n_years": len(yearly), "tracks_in_window": int(yearly.n_tracks.sum()),
    "first_last": {f: [float(yearly[f].iloc[0]), float(yearly[f].iloc[-1])] for f in F},
    "change_points": cps, "jan1_share_pct": jan1_share, "monthly_n_months": len(monthly),
    "stl": stl_res, "arima": {"order": [1, 1, 1], "train_end": 2010, "test_years": len(test), "mae": mae, "mae_naive": mae_naive},
    "decade_means": {int(k): v for k, v in dec.to_dict(orient="index").items()},
    "corr_with_year": corr_year,
    "loudness_1950s": float(dec.loc[1950, "loudness"]), "loudness_2010s": float(dec.loc[2010, "loudness"]),
})
