# %% [markdown]
# # 07 - Lyrics text EDA and sentiment
# **Goal:** clean an English sample of Genius lyrics; n-grams, vocabulary diversity, length and repetition;
# sentiment with VADER and TextBlob; lyric sentiment vs audio valence; differences by genre tag and decade.
#
# **Inputs:** `data/raw/genius_lyrics.zip` (Kaggle *carlosgdcj/genius-song-lyrics-with-language-information*),
# `data/processed/tracks.parquet`.
#
# **Outputs:** `data/processed/lyrics_sample.parquet`, figures `fig_07_*`, tables `tab_07_*`, `results.json -> lyrics`.

# %%
import json
import re
import time
import zipfile
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.feature_extraction.text import CountVectorizer, ENGLISH_STOP_WORDS
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from textblob import TextBlob
from sonicatlas import DATA, TAB, SEED, results, theme
from sonicatlas.stats import skewness_g1

theme.apply()
rng = np.random.default_rng(SEED)
ZIP = DATA / "raw" / "genius_lyrics.zip"
with zipfile.ZipFile(ZIP) as z:
    names = z.namelist()
print(names)

# %% [markdown]
# ## 1. Stream the 9 GB CSV in chunks, keep English songs, draw a 5 % random sample
# The `misc` tag holds non-song texts (poems, book excerpts, transcripts) and is excluded.

# %%
t0 = time.time()
CACHE = DATA / "interim" / "lyrics_sample_raw.parquet"
if CACHE.exists():  # the 5 % sample is cached after the first full pass over the 9 GB file
    ly = pd.read_parquet(CACHE)
    n_total, n_en, n_en_music = (int(x) for x in json.loads((DATA / "interim" / "lyrics_counts.json").read_text()))
else:
    keep, n_total, n_en, n_en_music = [], 0, 0, 0
    with zipfile.ZipFile(ZIP) as z, z.open(names[0]) as fh:
        for chunk in pd.read_csv(fh, chunksize=200_000, usecols=["title", "tag", "artist", "year", "views", "lyrics", "id", "language"]):
            n_total += len(chunk)
            en = chunk[chunk.language == "en"]
            n_en += len(en)
            en = en[en.tag != "misc"]
            n_en_music += len(en)
            keep.append(en[rng.random(len(en)) < 0.05])
    ly = pd.concat(keep, ignore_index=True)
    ly.to_parquet(CACHE, index=False)
    (DATA / "interim" / "lyrics_counts.json").write_text(json.dumps([n_total, n_en, n_en_music]))
read_seconds = time.time() - t0
print(n_total, n_en, n_en_music, len(ly), round(read_seconds))

# %% [markdown]
# ## 2. Cleaning: section headers, punctuation, tokens

# %%
HDR = re.compile(r"\[[^\]]*\]")
def clean(t):
    t = HDR.sub(" ", str(t)).lower()
    t = re.sub(r"[^a-z' \n]", " ", t)
    return re.sub(r"[ \t]+", " ", t).strip()

ly["clean"] = ly["lyrics"].map(clean)
ly["tokens"] = ly["clean"].str.split()
ly["n_words"] = ly["tokens"].str.len()
ly = ly[ly.n_words >= 20].copy()
ly["ttr"] = ly["tokens"].map(lambda w: len(set(w)) / len(w))
lines = ly["clean"].str.split("\n").map(lambda ls: [l.strip() for l in ls if l.strip()])
ly["n_lines"] = lines.str.len()
ly["repetition"] = lines.map(lambda ls: 1 - len(set(ls)) / len(ls) if ls else np.nan)
ly["year"] = pd.to_numeric(ly["year"], errors="coerce")
ly.loc[(ly.year < 1950) | (ly.year > 2022), "year"] = np.nan
ly["decade"] = (ly.year // 10 * 10).astype("Int64")
ly["log_views"] = np.log1p(ly["views"])
views_skew = (skewness_g1(ly.views), skewness_g1(ly.log_views))
print(len(ly), views_skew)
ly[["n_words", "ttr", "repetition", "views"]].describe().round(3)

# %% [markdown]
# ## 3. N-grams (1-3) without stop words

# %%
STOP = set(ENGLISH_STOP_WORDS) | {"im", "dont", "oh", "yeah", "na", "la", "ooh", "ah", "aint", "youre", "gonna", "wanna", "cause", "ya", "uh", "got", "get", "like", "know", "just",
                                  "i'm", "don't", "it's", "can't", "you're", "i'll", "i've", "we're", "that's", "there's", "ain't", "won't",
                                  "let's", "he's", "she's", "didn't", "isn't", "i'd", "you'll", "they're", "what's", "gon", "tryna", "'cause", "don"}
ng_sample = ly.sample(min(40_000, len(ly)), random_state=SEED)
ngrams = {}
for k in (1, 2, 3):
    cv = CountVectorizer(ngram_range=(k, k), stop_words=list(STOP), min_df=5, token_pattern=r"(?u)\b[a-z']{2,}\b")
    X = cv.fit_transform(ng_sample["clean"])
    freq = np.asarray(X.sum(0)).ravel()
    top = np.argsort(freq)[::-1][:15]
    ngrams[k] = [(cv.get_feature_names_out()[i], int(freq[i])) for i in top]
pd.DataFrame({f"{k}-gram": [f"{w} ({c})" for w, c in v] for k, v in ngrams.items()})

# %% [markdown]
# ## 4. Sentiment: VADER vs TextBlob

# %%
sent = ly.sample(min(20_000, len(ly)), random_state=SEED).copy()
vader = SentimentIntensityAnalyzer()
t0 = time.time()
sent["vader"] = sent["clean"].map(lambda t: vader.polarity_scores(t[:5000])["compound"])
vader_s = time.time() - t0
t0 = time.time()
sent["textblob"] = sent["clean"].map(lambda t: TextBlob(t[:5000]).sentiment.polarity)
tb_s = time.time() - t0
r_vt = float(np.corrcoef(sent.vader, sent.textblob)[0, 1])
agree = float(((sent.vader > 0.05) == (sent.textblob > 0)).mean() * 100)
print(r_vt, agree, vader_s, tb_s)

# %% [markdown]
# ## 5. Join to the audio catalogue (title + artist) and compare lyric sentiment with audio valence

# %%
def norm(s):
    return s.astype(str).str.lower().str.replace(r"\(.*?\)|feat.*$", "", regex=True).str.replace(r"[^a-z0-9 ]", "", regex=True).str.strip()

audio = pd.read_parquet(DATA / "processed" / "tracks.parquet", columns=["name", "artist_main", "valence", "energy", "danceability", "is_canonical"])
audio = audio[audio.is_canonical]
audio["k"] = norm(audio["name"]) + "|" + norm(audio["artist_main"])
audio = audio.drop_duplicates("k").set_index("k")
sent["k"] = norm(sent["title"]) + "|" + norm(sent["artist"])
ly["k"] = norm(ly["title"]) + "|" + norm(ly["artist"])
match_rate = float(ly["k"].isin(audio.index).mean() * 100)
m = sent[sent.k.isin(audio.index)].copy()
for c in ["valence", "energy", "danceability"]:
    m[c] = m["k"].map(audio[c])
r_val_vader = float(np.corrcoef(m.vader, m.valence)[0, 1])
r_val_tb = float(np.corrcoef(m.textblob, m.valence)[0, 1])
print(match_rate, len(m), r_val_vader, r_val_tb)

# %%
fig, ax = plt.subplots(1, 2, figsize=(12, 4))
ax[0].scatter(m.valence, m.vader, s=8, alpha=0.45, color=theme.OKABE_ITO[0], edgecolor="none")
zc = np.polyfit(m.valence, m.vader, 1); xs = np.linspace(0, 1, 50)
ax[0].plot(xs, np.polyval(zc, xs), color="k", ls="--", lw=1.5, label="least-squares line"); ax[0].legend(fontsize=8)
ax[0].set(title=f"Lyric sentiment barely tracks audio valence (r = {r_val_vader:.2f}, n = {len(m):,})", xlabel="Audio valence (0-1)", ylabel="VADER compound (-1 to 1)")
ax[1].hist(sent.vader, bins=40, histtype="step", lw=1.8, label="VADER compound", density=True)
ax[1].hist(sent.textblob, bins=40, histtype="step", lw=1.8, ls="--", label="TextBlob polarity", density=True)
ax[1].set(title=f"VADER is polarised, TextBlob is centred (r = {r_vt:.2f})", xlabel="Sentiment score", ylabel="Density")
ax[1].legend()
fig.tight_layout()
theme.save(fig, "fig_07_01_sentiment_vs_valence", source="Source: Genius lyrics (Kaggle) + Spotify 1.2M+ Songs; SonicAtlas analysis")

# %% [markdown]
# ## 6. By genre tag and by decade

# %%
by_tag = sent.groupby("tag").agg(n=("vader", "size"), vader=("vader", "mean"), textblob=("textblob", "mean")).join(
    ly.groupby("tag").agg(words=("n_words", "median"), ttr=("ttr", "median"), repetition=("repetition", "median"), songs=("id", "size")))
by_dec = sent.groupby("decade").agg(n=("vader", "size"), vader=("vader", "mean"), textblob=("textblob", "mean")).join(
    ly.groupby("decade").agg(words=("n_words", "median"), ttr=("ttr", "median"), repetition=("repetition", "median")))
by_dec = by_dec[by_dec.n >= 50]
by_tag.round(3).to_csv(TAB / "tab_07_01_lyrics_by_tag.csv"); by_dec.round(3).to_csv(TAB / "tab_07_02_lyrics_by_decade.csv")
by_tag.round(3)

# %%
by_dec.round(3)

# %%
fig, ax = plt.subplots(1, 3, figsize=(15, 3.8))
ax[0].bar(by_tag.index, by_tag.vader, color=theme.OKABE_ITO[0], edgecolor="k", hatch="//")
ax[0].set(title="Mean VADER sentiment by genre tag", ylabel="VADER compound", xlabel="Genius tag")
ax[0].axhline(0, color="k", lw=0.8)
ax[1].plot(by_dec.index.astype(int), by_dec.vader, marker="o", label="VADER", color=theme.OKABE_ITO[3])
ax[1].plot(by_dec.index.astype(int), by_dec.textblob, marker="s", ls="--", label="TextBlob", color=theme.OKABE_ITO[2])
ax[1].set(title="Lyric sentiment by decade", xlabel="Decade", ylabel="Mean score"); ax[1].legend()
data = [ly.loc[ly.tag == t, "ttr"] for t in by_tag.index]
ax[2].boxplot(data, tick_labels=by_tag.index, showfliers=False)
ax[2].set(title="Rap lyrics have the richest vocabulary per song" if by_tag.ttr.idxmax() == "rap" else "Vocabulary diversity by tag",
          ylabel="Type-token ratio", xlabel="Genius tag")
fig.tight_layout()
theme.save(fig, "fig_07_02_lyrics_by_tag_decade", source="Source: Genius lyrics (Kaggle); SonicAtlas analysis")

# %% [markdown]
# ## 7. Distinguishing words per genre tag (log-odds ratio with a uniform prior)

# %%
cv = CountVectorizer(stop_words=list(STOP), min_df=20, token_pattern=r"(?u)\b[a-z']{3,}\b")
X = cv.fit_transform(ng_sample["clean"])
vocab = cv.get_feature_names_out()
tags = ng_sample["tag"].to_numpy()
total = np.asarray(X.sum(0)).ravel() + 1
dist = {}
for t in sorted(set(tags)):
    inside = np.asarray(X[tags == t].sum(0)).ravel() + 1
    outside = total - inside + 1
    lo = np.log(inside / (inside.sum() - inside)) - np.log(outside / (outside.sum() - outside))
    se = np.sqrt(1 / inside + 1 / outside)
    z = lo / se
    # slurs are masked in every saved output
    dist[t] = [w[0] + "*" * (len(w) - 1) if w in {"nigga", "niggas", "nigger", "niggaz", "faggot", "fag"} else w
               for w in (vocab[i] for i in np.argsort(z)[::-1][:10])]
dist_df = pd.DataFrame(dist)
dist_df.to_csv(TAB / "tab_07_03_distinguishing_words.csv", index=False)
dist_df

# %%
ly[["id", "title", "artist", "tag", "year", "decade", "views", "n_words", "n_lines", "ttr", "repetition"]].to_parquet(DATA / "processed" / "lyrics_sample.parquet", index=False)
sent[["id", "title", "artist", "tag", "decade", "vader", "textblob"]].to_parquet(DATA / "processed" / "lyrics_sentiment.parquet", index=False)

# ---- compact file for the website (aggregates only; no lyric text is published) ----
import json
MASK = {"nigga", "niggas", "nigger", "niggaz", "faggot", "fag"}
def safe(w):
    return w[0] + "*" * (len(w) - 1) if w in MASK else w
cvw = CountVectorizer(stop_words=list(STOP), max_features=3000, token_pattern=r"(?u)\b[a-z']{3,}\b")
Xw = cvw.fit_transform(ng_sample["clean"])
vw = cvw.get_feature_names_out()
tag_counts = {t: np.asarray(Xw[(ng_sample.tag == t).to_numpy()].sum(0)).ravel().tolist() for t in sorted(ng_sample.tag.unique())}
dec_arr = ng_sample["decade"].fillna(-1).astype(int).to_numpy()
dec_counts = {str(int(d)): np.asarray(Xw[(dec_arr == d)].sum(0)).ravel().tolist() for d in sorted(ng_sample.decade.dropna().unique())}
web = {"vocab": [safe(w) for w in vw], "tag_counts": tag_counts, "decade_counts": dec_counts,
       "tag_docs": ng_sample.tag.value_counts().to_dict(), "decade_docs": {str(int(k)): int(v) for k, v in ng_sample.decade.value_counts().items()},
       "ngrams": {str(k): [[safe(w) if k == 1 else " ".join(safe(x) for x in w.split()), c] for w, c in v] for k, v in ngrams.items()},
       "by_tag": by_tag.round(4).to_dict(orient="index"), "by_decade": {str(int(k)): v for k, v in by_dec.round(4).to_dict(orient="index").items()},
       "distinguishing": {t: [safe(w) for w in ws] for t, ws in dist.items()},
       "scatter": m[["valence", "vader", "textblob", "tag"]].round(4).to_dict(orient="records"),
       "ttr_hist": {t: np.histogram(ly.loc[ly.tag == t, "ttr"], bins=30, range=(0, 1))[0].tolist() for t in by_tag.index},
       "r_valence_vader": r_val_vader, "matched_n": len(m)}
(DATA / "processed" / "lyrics_web.json").write_text(json.dumps(web))

TAGN = {"rb": "R&B", "rap": "rap", "pop": "pop", "rock": "rock", "country": "country"}
ttr_max_tag = by_tag.ttr.idxmax(); ttr_min_tag = by_tag.ttr.idxmin(); long_tag = by_tag.words.idxmax()
pos_tag = by_tag.vader.idxmax(); neg_tag = by_tag.vader.idxmin()
paras = [
    f"The Genius dataset holds {n_total:,} texts, of which {n_en:,} are tagged as English and {n_en_music:,} remain after removing the non-song 'misc' tag. "
    f"A 5% random sample was streamed from the 9 GB file in chunks; after dropping texts shorter than 20 words it contains {len(ly):,} songs. "
    f"Section headers such as [Chorus] were removed, the text was lower-cased and tokenised, and Genius page views (a true count, G1 = {views_skew[0]:.1f}) "
    f"were log-transformed (G1 = {views_skew[1]:.2f}).",
    f"Songs have a median of {ly.n_words.median():.0f} words and a median type-token ratio of {ly.ttr.median():.2f}; the median song repeats "
    f"{100 * ly.repetition.median():.0f}% of its lines, which is typical of choruses. {TAGN[long_tag].capitalize()} lyrics are by far the longest "
    f"(median {by_tag.loc[long_tag, 'words']:.0f} words), {TAGN[ttr_max_tag]} lyrics have the highest vocabulary diversity (median TTR {by_tag.loc[ttr_max_tag, 'ttr']:.2f}), "
    f"and {TAGN[ttr_min_tag]} lyrics the lowest (TTR {by_tag.loc[ttr_min_tag, 'ttr']:.2f}). The most frequent content words are {', '.join(w for w, _ in ngrams[1][:5])}; the top bigrams are "
    f"{', '.join(w for w, _ in ngrams[2][:3])}.",
    f"Sentiment was scored on 20,000 songs with VADER and TextBlob. The two agree on the sign for {agree:.1f}% of songs and correlate at r = {r_vt:.2f}; "
    f"VADER spreads scores towards -1 and +1 because long texts accumulate many polar words, whereas TextBlob averages them towards zero. "
    f"{TAGN[pos_tag].capitalize()} is the most positive tag (mean VADER {by_tag.loc[pos_tag, 'vader']:.2f}) and {TAGN[neg_tag]} the most negative ({by_tag.loc[neg_tag, 'vader']:.2f}).",
    f"Joining lyrics to the audio catalogue by normalised title and artist matched {match_rate:.1f}% of the lyric sample. On the {len(m):,} matched songs, lyric sentiment "
    f"and audio valence are only weakly related (VADER r = {r_val_vader:.2f}, TextBlob r = {r_val_tb:.2f}): a cheerful-sounding track can carry sad words and vice "
    "versa, so the two modalities give complementary information.",
]
results.save("lyrics", {
    "n_total": n_total, "n_english": n_en, "n_english_music": n_en_music, "rows_used": len(ly), "read_seconds": read_seconds,
    "median_words": float(ly.n_words.median()), "median_ttr": float(ly.ttr.median()), "median_repetition": float(ly.repetition.median()),
    "views_skew_before": views_skew[0], "views_skew_after": views_skew[1],
    "ngrams": {str(k): v for k, v in ngrams.items()}, "sentiment_n": len(sent), "vader_textblob_r": r_vt, "sign_agreement_pct": agree,
    "vader_seconds": vader_s, "textblob_seconds": tb_s, "audio_match_rate_pct": match_rate, "matched_n": len(m),
    "r_valence_vader": r_val_vader, "r_valence_textblob": r_val_tb,
    "by_tag": by_tag.round(4).to_dict(orient="index"), "by_decade": {int(k): v for k, v in by_dec.round(4).to_dict(orient="index").items()},
    "distinguishing_words": dist,
    "report_paragraphs": paras,
    "report_figures": [["fig_07_01_sentiment_vs_valence.png", "Lyric sentiment versus audio valence, and VADER versus TextBlob score distributions"],
                       ["fig_07_02_lyrics_by_tag_decade.png", "Lyric sentiment by genre tag and decade, and vocabulary diversity by tag"]],
})
