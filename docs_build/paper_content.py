"""Content of the IEEE paper as a neutral structure, rendered to LaTeX and to Word.

Markup inside paragraphs: [[cite:id1,id2]] for citations, **bold**, *italic*. Every number comes from results.json.
The wording is written separately from the project report so the two documents do not duplicate each other.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import R, LIT, f, n, pct, pval  # noqa: E402

r = R()
A, C, D, M, DR, TS, T = (r["audit"], r["cleaning"], r["descriptive"], r["multivariate"], r["dimred"], r["timeseries"], r["tests"])
LY, PR, NET, WEB = r.get("lyrics"), r.get("profiling"), r.get("network"), r.get("web")
fl = TS["first_last"]
cp = DR["comparison"]

from common import TITLE  # noqa: E402  (same title in every document)
AUTHORS = [
    ("Sharvesh Prabhu", "25BDS0318", "<email>"),
    ("Nithin S", "25BDS0308", "nithin.s2025a@vitstudent.ac.in"),
]
AFFIL = "School of Computer Science and Engineering, Vellore Institute of Technology, Vellore, India"

ABSTRACT = (
    f"Archived Spotify audio descriptors are among the few open windows onto the acoustic character of recorded music, "
    f"but most analyses of them are static and stop at a handful of charts. We describe SonicAtlas, a reproducible "
    f"exploratory pipeline and a serverless web platform built on {n(A['a_rows'])} tracks, {n(C['rows_genre_tracks'])} "
    f"genre-labelled tracks in {A['g_genres']} genres and a {n(LY['rows_used']) if LY else 'large'}-song English lyrics sample. "
    f"Impossible values are repaired with chained-equation imputation that lowers masked-value error by up to "
    f"{f(max(v['improvement_pct'] for v in C['mice_validation'].values()), 1)}% relative to mean filling, and outliers are "
    f"flagged rather than removed. Across {TS['year_window'][0]}-{TS['year_window'][1]}, average loudness climbs by "
    f"{f(fl['loudness'][1] - fl['loudness'][0], 1)} dB while acousticness falls from {f(fl['acousticness'][0], 2)} to "
    f"{f(fl['acousticness'][1], 2)}, with loudness change points at {', '.join(map(str, TS['change_points']['loudness'][1:]))}. "
    f"Genre accounts for {pct(100 * T['anova']['eta_squared'], 1)} of the variance of danceability, yet genre labels overlap "
    f"strongly in every two-dimensional embedding; t-SNE attains the highest trustworthiness "
    f"({f(cp['t-SNE']['trustworthiness_k10'], 3)}) among PCA, LLE, UMAP and t-SNE. "
    + (f"Lyric sentiment is almost unrelated to audio valence (r = {f(LY['r_valence_vader'], 2)}). " if LY else "")
    + "All results are explorable in the browser through SQL executed by DuckDB-WASM on Parquet files, with no server.")
INDEX_TERMS = ["exploratory data analysis", "music information retrieval", "audio features", "dimensionality reduction",
               "time-series analysis", "in-browser analytics"]


def sections() -> list[dict]:
    S = []
    S.append({"h": "Introduction", "p": [
        "Popular music has been studied quantitatively for more than a decade, from the long-run homogenisation of timbre and "
        "loudness [[cite:serra2012evolution]] to revolutions in US chart music [[cite:mauch2015evolution]] and the "
        "predictability of commercial success [[cite:interiano2018trends,askin2017popular]]. Streaming platforms made such work "
        "easier by publishing per-track descriptors such as energy, valence and danceability, and large crawls of these values "
        "still circulate on open-data portals even though the original API endpoint has been closed to new applications.",
        "Two practical problems limit the value of these crawls. First, the raw tables contain impossible values, duplicated "
        "re-issues and sources that do not share keys, and published studies rarely say how such issues were treated. Second, "
        "results are usually frozen into figures, so a reader cannot ask a slightly different question without rebuilding the "
        "pipeline. This paper addresses both problems. Our contributions are: (i) a documented cleaning pipeline over 1.2 million "
        "tracks with validated imputation and explicit outlier and re-issue flags; (ii) a systematic exploration that combines "
        "course-standard descriptive statistics, multivariate views, four embedding methods, clustering, time-series "
        "decomposition, hypothesis tests and lyrics mining; and (iii) SonicAtlas, a static web application in which every table "
        "can be filtered, queried and compared in the reader's own browser.",
    ]})
    S.append({"h": "Related Work", "p": [
        "**Audio descriptors and genre.** Large open collections such as the Million Song Dataset [[cite:bertinmahieux2011msd]] "
        "and handcrafted features for genre recognition [[cite:tzanetakis2002genre]] established the use of numeric audio "
        "summaries, and deep models now learn such features directly from audio [[cite:vandenoord2013deep]].",
        "**Trends and popularity.** Studies of musical evolution [[cite:serra2012evolution,mauch2015evolution]] and hit prediction "
        "[[cite:interiano2018trends,askin2017popular]] report strong temporal signals but publish them as static "
        "results. Lyrics research shows rising negativity over time [[cite:brand2019lyrics]], usually without the matching "
        "audio view; sentiment is often scored with VADER "
        "[[cite:hutto2014vader]]. Recommendation surveys [[cite:schedl2018challenges]] motivate similarity search over descriptors.",
        "**Embeddings and EDA tooling.** PCA [[cite:jolliffe2016pca]], LLE [[cite:roweis2000lle]], t-SNE "
        "[[cite:vandermaaten2008tsne]] and UMAP [[cite:mcinnes2018umap]] are standard for maps of high-dimensional data. "
        "Automated EDA has been surveyed by Milo and Somech [[cite:milo2020autoeda]], and interactive charts are commonly "
        "specified with declarative grammars such as Vega-Lite [[cite:satyanarayan2017vegalite]]. "
        "On the systems side, embeddable analytical engines [[cite:raasveldt2019duckdb]], their WebAssembly port "
        "[[cite:kohn2022duckdbwasm]] and scalable linked views [[cite:heer2024mosaic]] make serverless analysis feasible. The "
        "closest system in spirit is a Streamlit application for exploratory analysis of clinical data [[cite:dasilva2025parkinson]], "
        "which, unlike SonicAtlas, requires a Python server and is not domain-aware for music.",
    ]})
    j = C["join"]
    S.append({"h": "Datasets and Preprocessing", "p": [
        f"We combine three public Kaggle datasets: a crawl of {n(A['a_rows'])} tracks with audio descriptors and release dates "
        f"[[cite:kaggle_spotify12m]], a genre-balanced table of {n(A['g_rows'])} rows covering {A['g_genres']} genres "
        f"[[cite:kaggle_spotify_tracks]], and Genius lyrics with language tags [[cite:kaggle_genius_lyrics]]. Raw files are "
        "checksummed and never modified.",
        f"**Repairs.** {n(C['tempo_zero_imputed'])} tracks report 0 BPM and {n(C['time_signature_zero_imputed'])} a time signature "
        f"of 0. Both are treated as missing and imputed with chained equations (MICE) [[cite:vanbuuren2011mice]] using the "
        f"remaining descriptors. Because the descriptors have no natural gaps, we hid 5% of known values: the imputer reduced RMSE "
        f"versus mean filling by {f(C['mice_validation']['energy']['improvement_pct'], 1)}% for energy, "
        f"{f(C['mice_validation']['valence']['improvement_pct'], 1)}% for valence and only "
        f"{f(C['mice_validation']['tempo']['improvement_pct'], 1)}% for tempo, which the other features predict poorly.",
        f"**Duplicates and joins.** The earliest release of each normalised title and lead artist is marked canonical; "
        f"{n(C['reissue_rows'])} re-issues are excluded from temporal statistics. De-duplicating multi-genre rows leaves "
        f"{n(j['genre_unique_tracks'])} genre tracks, of which only {pct(j['match_rate_pct'])} can be linked to the main table by "
        "track ID or title and artist, so genre analyses use the genre table on its own.",
        f"**Transforms and outliers.** Skewed fields are transformed (duration G1 {f(C['skew']['duration_min']['before'], 2)} "
        f"to {f(C['skew']['duration_min']['after'], 2)} after log1p), and Min-Max and z-score versions are stored. Tukey fences "
        f"and an Isolation Forest [[cite:liu2008iforest]] flag outliers; the forest marks {n(C['iso_outliers'])} tracks "
        f"({pct(C['iso_pct'])}), dominated by spoken-word content (mean speechiness {f(C['iso_outlier_mean_speechiness'], 2)} "
        f"vs {f(C['iso_inlier_mean_speechiness'], 2)}).",
    ]})
    S.append({"h": "Methodology", "p": [
        "**Descriptive statistics** follow the conventions of our course: sample variance with denominator n-1, Tukey hinges "
        "for quartiles, the adjusted Fisher-Pearson skewness G1 and the bias-corrected excess kurtosis G2. The implementation "
        "is unit-tested against SciPy and a textbook example. Table I lists the resulting summary for the main descriptors.",
        "**Multivariate analysis** uses Pearson and Spearman matrices on a 300,000-track sample, and parallel coordinates, "
        "Andrews curves, radar and violin plots on a balanced sample of eight genres.",
        f"**Embeddings and clusters.** PCA is fitted on all tracks; t-SNE (perplexity 30), LLE (15 neighbours) and UMAP run on a "
        f"{n(DR['sample_size'])}-track sample stratified by genre. Methods are compared by runtime, trustworthiness at k = 10 and "
        f"silhouette with genre labels. KMeans is run on the first {DR['n90']} principal components for k = 2-10, and HDBSCAN "
        "checks for density structure.",
        "**Time series.** Yearly means of canonical releases are smoothed with 5-year windows, decomposed with STL "
        "[[cite:cleveland1990stl]] at monthly resolution, segmented with PELT change-point detection [[cite:truong2020ruptures]], "
        "and forecast with ARIMA(1,1,1) evaluated on a ten-year hold-out against a naive baseline.",
        "**Tests and text.** Genre differences are tested with one-way ANOVA and Tukey HSD, a Kruskal-Wallis check and a "
        "chi-square test with Cramer's V; features are ranked by filter criteria and by recursive feature elimination. Lyrics are "
        "cleaned and scored with VADER [[cite:hutto2014vader]] and TextBlob [[cite:textblob]]. Tooling is built on pandas "
        "[[cite:mckinney2010pandas]] and scikit-learn [[cite:pedregosa2011sklearn]].",
    ]})
    S[-1]["tables"] = [("Descriptive Statistics of Selected Audio Features (n = " + n(A["a_rows"]) + ")",
                        ["Feature", "Mean", "Median", "IQR", "G1", "G2"],
                        [[k.replace("_min", ""), f(D["all"][k]["mean"], 3), f(D["all"][k]["median"], 3), f(D["all"][k]["iqr"], 3),
                          f(D["all"][k]["g1"], 2), f(D["all"][k]["g2"], 2)]
                         for k in ["danceability", "energy", "loudness", "speechiness", "acousticness", "instrumentalness", "valence", "tempo", "duration_min"]])]
    S.append({"h": "System Architecture of SonicAtlas", "p": [
        "Fig. 1 summarises the design. All expensive steps run once in Python and emit columnar Parquet files, precomputed "
        "embeddings and a single JSON file of results. The website is a static React bundle. On load, DuckDB-WASM "
        "[[cite:kohn2022duckdbwasm]] starts in a Web Worker and reads the Parquet files over HTTP, so filtering, aggregation and "
        "similarity search run as SQL on the user's machine. A rule-based parser turns short English requests into SQL that is "
        "shown to the user, and every view stores its state in the URL so that a result can be shared as a link. The site is "
        "deployed to GitHub Pages without any backend.",
    ], "fig": ("fig_00_01_system_architecture.png", "SonicAtlas architecture: offline Python pipeline and in-browser query engine.", True)})
    pr = M["pairs"]
    an = T["anova"]
    res = [
        f"**Structure of the feature space.** Fig. 2 shows the correlation structure. Loudness and energy are tightly coupled (r = {f(pr['loudness~energy']['pearson'], 2)}) "
        f"and energy opposes acousticness (r = {f(pr['energy~acousticness']['pearson'], 2)}); Spearman coefficients agree, so the "
        f"relations are monotonic. PCA concentrates {pct(100 * DR['evr'][0])} of the variance in an electric-versus-acoustic first "
        f"component and needs {DR['n90']} components for 90%.",
        f"**Embeddings.** Table II compares the four methods and Fig. 3 shows the maps. t-SNE keeps local neighbourhoods best "
        f"(trustworthiness {f(cp['t-SNE']['trustworthiness_k10'], 3)}), UMAP is close ({f(cp['UMAP']['trustworthiness_k10'], 3)}) "
        f"and LLE is weakest ({f(cp['LLE']['trustworthiness_k10'], 3)}). Silhouette scores computed with genre labels are "
        f"negative for every method and in the original space ({f(cp['Original 10-D']['silhouette_focus_genres'], 3)}), showing that "
        "genre is only partly encoded by the descriptors. KMeans with six clusters yields interpretable groups (Table III, Fig. 4), "
        f"while HDBSCAN labels {pct(DR['hdbscan_noise_pct'], 0)} of points as noise, consistent with a continuum.",
        f"**Temporal dynamics.** Fig. 5 shows the yearly trends and Fig. 6 the detected change points. Mean loudness rose from {f(fl['loudness'][0], 1)} dB in "
        f"{TS['year_window'][0]} to {f(fl['loudness'][1], 1)} dB in {TS['year_window'][1]}, with breaks in "
        f"{', '.join(map(str, TS['change_points']['loudness'][1:]))} that coincide with the period of aggressive CD mastering; "
        f"energy and acousticness break in {TS['change_points']['energy'][-1]}. The ARIMA forecast of loudness reaches an MAE of "
        f"{f(TS['arima']['mae'], 2)} dB, practically equal to the naive baseline ({f(TS['arima']['mae_naive'], 2)} dB), because "
        f"loudness plateaued after 2010. STL finds modest seasonality in valence (strength {f(TS['stl']['valence']['seasonal_strength'], 2)}).",
        f"**Genre tests.** One-way ANOVA rejects equal mean danceability across eight genres (F({an['df_between']}, "
        f"{n(an['df_within'])}) = {f(an['F'], 1)}, {pval(an['p'])}, eta squared = {f(an['eta_squared'], 3)}), Tukey HSD separates "
        f"{T['tukey_sig_pairs']} of {T['tukey_pairs']} pairs, and Kruskal-Wallis agrees. Mode depends on genre "
        f"(chi-square = {f(T['chi2_mode_genre']['chi2'], 1)}, V = {f(T['chi2_mode_genre']['cramers_v'], 3)}), with country the most "
        f"major-key genre; Table IV collects the tests. With more than a million rows even tiny effects become significant, so "
        f"we interpret effect sizes: the genre effect on danceability is large, while the drift of mode across decades "
        f"(V = {f(T['chi2_mode_decade']['cramers_v'], 3)}) is negligible. Acousticness and loudness lead the filter and wrapper rankings alike.",
    ]
    if LY:
        res.append(
            f"**Lyrics.** In {n(LY['rows_used'])} English songs the median lyric has {f(LY['median_words'], 0)} words and repeats "
            f"{pct(100 * LY['median_repetition'], 0)} of its lines. VADER and TextBlob agree on polarity for "
            f"{pct(LY['sign_agreement_pct'])} of songs (r = {f(LY['vader_textblob_r'], 2)}). Country lyrics are the most positive and rap "
            f"the most negative. For the {n(LY['matched_n'])} songs linked to "
            f"audio descriptors, lyric sentiment and valence correlate at only r = {f(LY['r_valence_vader'], 2)}, so words and sound "
            "carry largely independent emotional information (Fig. 7).")
    if PR:
        res.append(
            f"**Automated EDA tools.** YData-Profiling, Sweetviz and D-Tale produced their outputs in {f(PR['ydata_seconds'], 0)}, "
            f"{f(PR['sweetviz_seconds'], 0)} and {f(PR['dtale_seconds'], 0)} s and caught skew and correlation, but none flagged the "
            "physically impossible tempo values or performed tests, embeddings or decomposition.")
    if WEB and WEB.get("paper_sentence"):
        res.append(WEB["paper_sentence"])
    S.append({"h": "Results and Discussion", "p": res,
              "tables": [("Comparison of Dimensionality-Reduction Methods",
                          ["Method", "Time (s)", "Trust.", "Silh."],
                          [[k, f(v["runtime_s"], 1), f(v["trustworthiness_k10"], 3), f(v["silhouette_focus_genres"], 3)] for k, v in cp.items()]),
                         ("Named KMeans Clusters (k = " + str(DR["k_used"]) + ")",
                          ["Cluster", "Share", "Energy", "Acoust.", "Speech."],
                          [[v["name"], pct(v["share_pct"]), f(v["energy"], 2), f(v["acousticness"], 2), f(v["speechiness"], 2)] for v in DR["clusters"].values()]),
                         ("Summary of Hypothesis Tests",
                          ["Test", "Statistic", "p", "Effect"],
                          [["ANOVA (danceability)", "F = " + f(T["anova"]["F"], 1), pval(T["anova"]["p"]).replace("p ", ""), "eta2 = " + f(T["anova"]["eta_squared"], 3)],
                           ["Kruskal-Wallis", "H = " + f(T["kruskal"]["H"], 0), pval(T["kruskal"]["p"]).replace("p ", ""), "eps2 = " + f(T["kruskal"]["epsilon_squared"], 3)],
                           ["Chi-sq mode x genre", f(T["chi2_mode_genre"]["chi2"], 1), pval(T["chi2_mode_genre"]["p"]).replace("p ", ""), "V = " + f(T["chi2_mode_genre"]["cramers_v"], 3)],
                           ["Chi-sq mode x decade", f(T["chi2_mode_decade"]["chi2"], 0), pval(T["chi2_mode_decade"]["p"]).replace("p ", ""), "V = " + f(T["chi2_mode_decade"]["cramers_v"], 3)]])],
              "figs": [("fig_04_01_correlation_heatmaps.png", "Pearson (left) and Spearman (right) correlation matrices of ten audio descriptors.", True),
                       ("fig_05_02_tsne_lle_pca_maps.png", "PCA, t-SNE, LLE and UMAP projections of a genre-stratified 10,000-track sample; eight genres highlighted.", True),
                       ("fig_05_05_clusters_on_tsne.png", "Six named KMeans clusters on the t-SNE map of 10,000 tracks.", False),
                       ("fig_06_02_yearly_trends_rolling.png", "Yearly means (thin) and 5-year rolling means (dashed) of six descriptors.", True),
                       ("fig_06_03_change_points.png", "PELT change points in yearly loudness and acousticness.", False)]
              + ([("fig_07_01_sentiment_vs_valence.png", "Lyric sentiment versus audio valence (left) and VADER versus TextBlob score distributions (right).", False)] if LY else [])})
    S.append({"h": "Conclusion and Future Work", "p": [
        "SonicAtlas shows that a careful, documented treatment of open music descriptors changes what can be said about them: "
        "impossible values and re-issues are common enough to matter, genre labels overlap far more than charts usually suggest, "
        "and the most robust temporal story is a rise in loudness and energy together with a decline of acoustic sound. "
        "Delivering the results through an in-browser SQL engine lets readers verify and extend each finding without "
        "installing anything.",
        "Limitations include the proprietary nature of the descriptors, the catalogue's bias towards recent releases, the low "
        "match rate between sources and the English-only lyrics sample. Future work will add open audio features, multilingual "
        "lyrics and a user study comparing task completion in SonicAtlas and in notebooks.",
    ]})
    return S


ACK = ("The authors thank Vellore Institute of Technology, Vellore, and the faculty of the BACSE301 Exploratory Data "
       "Analysis course for their guidance, and the creators of the public datasets and open-source libraries used here.")


def references() -> list[dict]:
    return LIT()["papers"] + LIT()["software"]
