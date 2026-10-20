// Review-2 deck: design done, implementation in progress, first results (max 10 slides).
const path = require("path");
const fs = require("fs");
const D = require("./deck_common");
const { R, LIT, n, f, pct } = D;

const A = R.audit, C = R.cleaning, DS = R.descriptive, M = R.multivariate, DR = R.dimred, TS = R.timeseries;
const STATUS = JSON.parse(fs.readFileSync(path.join(__dirname, "status.json"), "utf8"));
const pres = D.newDeck("BACSE301 EDA - Review-2 presentation, Team 05");

// 1 Title
let s = D.titleSlide(pres, "Review-2  |  Design complete, implementation in progress", "October 2026");
s.addNotes("Good morning. We are Team 05, Sharvesh Prabhu and Nithin S. Our project is SonicAtlas: an exploratory data analysis of more than one million Spotify tracks, delivered as a website that runs SQL queries inside the browser. In this review we show the finished design, the cleaned data and our first analysis results.");

// 2 Recap
s = D.content(pres, "We map how the sound of music changes across genres and eras", "Recap: abstract and objectives");
D.card(s, 0.5, 1.7, 5.9, 5.0, "Abstract",
  `Public Spotify tables describe each track with audio features such as energy, valence and danceability. We clean ${n(A.a_rows)} tracks (${A.a_year_min}-${A.a_year_max}) plus a genre table of ${n(C.rows_genre_tracks)} tracks in ${A.g_genres} genres and Genius lyrics, explore them with the course methods, and publish the results in a serverless, in-browser query tool.`, { size: 17 });
s.addText("Objectives", { x: 6.8, y: 1.7, w: 6, h: 0.45, fontSize: 20, bold: true, color: D.COL.ink, margin: 0, isTextBox: true });
s.addText([
  "Clean 1M+ tracks; validate MICE by masking 5% of values",
  "Descriptive stats in course conventions (n-1, Tukey IQR, G1, G2)",
  "Correlation and multivariate genre fingerprints",
  "Compare PCA, t-SNE, LLE, UMAP; name acoustic clusters",
  "Trends, STL seasonality, change points, forecast",
  "ANOVA, chi-square, feature selection; lyrics sentiment",
  "In-browser SQL with lite-data queries under 1 second",
].map((t, i, a) => ({ text: t, options: { bullet: { type: "number" }, breakLine: i < a.length - 1 } })), { x: 6.8, y: 2.25, w: 6.0, h: 4.4, fontSize: 16, color: D.COL.ink, paraSpaceAfter: 6, margin: 0, valign: "top", isTextBox: true });
s.addNotes("In short: we take large public Spotify tables, clean them carefully, analyse them with the methods from our syllabus, and put everything into a website. These seven objectives are measurable, and each one maps to a notebook in our repository.");

// 3 Literature
s = D.content(pres, "Prior work is static and studies sound and words apart", "Literature survey and gaps");
const SUM = {
  serra2012evolution: ["Tracked pitch, timbre and loudness of Western pop over 50+ years", "Static figures; no genre-level or interactive view"],
  interiano2018trends: ["Linked audio features of 500k UK releases to chart success", "No lyrics; results cannot be re-sliced by readers"],
  brand2019lyrics: ["Measured rising negativity in song lyrics over 50 years", "Lyrics only; audio mood not compared"],
  vandermaaten2008tsne: ["Introduced t-SNE for 2-D maps of high-dimensional data", "Global distances unreliable; no music benchmark"],
  dasilva2025parkinson: ["Streamlit web app for EDA and ML on medical data", "Needs a server; not music-aware"],
};
const pick = Object.keys(SUM).map((id) => LIT.papers.find((p) => p.id === id)).filter(Boolean);
D.table(s, ["Study", "What they did", "Gap SonicAtlas addresses"], pick.map((p) => [D.cite(p), SUM[p.id][0], SUM[p.id][1]]),
  0.5, 1.7, 12.3, [2.9, 5.0, 4.4], 15);
[["Static results", "fixed figures, no re-slicing"], ["Sound vs words", "audio and lyrics never compared"], ["Data quality", "zero tempos, re-issues ignored"], ["Generic tools", "not music-aware, need a server"]]
  .forEach(([t, b], i) => D.card(s, 0.5 + i * 3.1, 4.55, 2.9, 1.6, t, b, { size: 16, titleSize: 18 }));
s.addText(`${LIT.papers.length} verified papers reviewed in the report (Table I).`, { x: 0.5, y: 6.45, w: 12, h: 0.4, fontSize: 14, italic: true, color: D.COL.muted, margin: 0, isTextBox: true });
s.addNotes("We reviewed " + LIT.papers.length + " published papers. This table shows five representative ones. The common gaps are: results are fixed figures that readers cannot re-slice, audio and lyrics are studied separately, data cleaning is rarely described, and generic EDA tools are not music-aware.");

// 4 Architecture
s = D.content(pres, "Heavy maths runs offline; querying runs in the user's browser", "Proposed system and architecture");
D.image(s, "fig_00_01_system_architecture.png", 0.5, 1.6, 12.3, 5.3);
s.addNotes("Our architecture has two halves. On the left, Python notebooks clean the data and compute statistics, embeddings and clusters, and export small Parquet files. On the right, the browser loads DuckDB compiled to WebAssembly, which runs SQL on those files locally. So there is no server, the data stays private, and hosting on GitHub Pages is free.");

// 5 Data and preprocessing
s = D.content(pres, "1.2 million tracks cleaned, with every repair measured", "Dataset and preprocessing done");
const st = [[n(A.a_rows), "tracks in the main audio table"], [n(C.tempo_zero_imputed), "zero-BPM tempos imputed with MICE"],
  [pct(C.mice_validation.energy.improvement_pct), "lower error than mean imputation (energy, 5% masked)"], [n(C.reissue_rows), "re-issues flagged, kept out of trends"],
  [n(C.iso_outliers), "Isolation Forest outliers flagged, not dropped"], [pct(C.join.match_rate_pct), "genre table matched to audio table (honest)"]];
st.forEach(([v, l], i) => D.stat(s, 0.5 + (i % 3) * 4.15, 1.75 + Math.floor(i / 3) * 1.8, 3.9, v, l));
s.addText(`Duration skew G1 ${f(C.skew.duration_min.before, 2)} -> ${f(C.skew.duration_min.after, 2)} after log1p; Min-Max and z-score tables stored separately.`, { x: 0.5, y: 5.55, w: 12.3, h: 0.45, fontSize: 16, color: D.COL.ink, margin: 0, isTextBox: true });
s.addText("Sources: Kaggle rodolfofigueroa/spotify-12m-songs, maharshipandya/-spotify-tracks-dataset, carlosgdcj/genius-song-lyrics-with-language-information", { x: 0.5, y: 6.1, w: 12.3, h: 0.6, fontSize: 12, color: D.COL.muted, margin: 0, isTextBox: true });
s.addNotes(`We downloaded three public Kaggle datasets. ${n(C.tempo_zero_imputed)} tracks had a tempo of zero, which is impossible, so we treated it as missing and used MICE. To prove MICE works we hid 5 percent of known values: its error was ${pct(C.mice_validation.energy.improvement_pct)} lower than mean filling for energy. We flagged re-issues and outliers instead of deleting them. The genre table only matched ${pct(C.join.match_rate_pct)} of tracks, and we report that honestly.`);

// 6 Descriptive stats
s = D.content(pres, "Speechiness and duration are right-skewed; danceability is not", "Descriptive statistics results");
const feats = ["danceability", "energy", "loudness", "speechiness", "acousticness", "valence", "tempo", "duration_min"];
D.table(s, ["Feature", "Mean", "Median", "Var (n-1)", "IQR", "G1", "G2"], feats.map((k) => {
  const v = DS.all[k]; return [k, f(v.mean, 3), f(v.median, 3), f(v.variance, 3), f(v.iqr, 3), f(v.g1, 2), f(v.g2, 2)];
}), 0.5, 1.7, 7.3, [1.9, 0.95, 0.95, 1.1, 0.9, 0.75, 0.75], 15);
D.image(s, "fig_03_01_feature_histograms_kde.png", 8.0, 1.75, 4.8, 3.6);
s.addText("Tukey quartiles (median of halves), n-1 variance, adjusted G1 and bias-corrected G2, unit-tested against SciPy.", { x: 8.0, y: 3.8, w: 4.8, h: 1.0, fontSize: 16, color: D.COL.muted, margin: 0, isTextBox: true });
s.addNotes(`This table uses exactly the conventions from our tutorials. Speechiness has skewness ${f(DS.all.speechiness.g1, 2)} and excess kurtosis ${f(DS.all.speechiness.g2, 1)}: most songs are sung, with a long tail of spoken tracks. Danceability is almost symmetric. Loudness is left-skewed because quiet classical and ambient tracks pull the tail down.`);

// 7 Correlation and multivariate
s = D.content(pres, "Energy follows loudness and opposes acousticness", "Correlation and multivariate results");
D.image(s, "fig_04_01_correlation_heatmaps.png", 0.5, 1.6, 6.3, 3.9);
D.image(s, "fig_04_02_parallel_coordinates_genres.png", 7.0, 1.6, 5.8, 3.9);
const pr = M.pairs;
D.bullets(s, [`Loudness ~ energy r = ${f(pr["loudness~energy"].pearson, 2)}; energy ~ acousticness r = ${f(pr["energy~acousticness"].pearson, 2)}`,
  `Valence ~ danceability r = ${f(pr["valence~danceability"].pearson, 2)}: happier songs are somewhat more danceable`,
  "Parallel coordinates: classical = acoustic + instrumental; hip-hop = speechy + danceable; metal = highest energy"], 0.5, 5.0, 12.3, 1.6, 17);
s.addNotes("The heatmap shows three trade-offs: loud songs are energetic, energetic songs are not acoustic, and happy-sounding songs are a bit more danceable. Pearson and Spearman agree, so these are not caused by outliers. On the right, parallel coordinates show each genre's fingerprint across seven features.");

// 8 Dimensionality reduction
s = D.content(pres, "t-SNE keeps local structure best; genres overlap in every map", "Dimensionality reduction first results");
D.image(s, "fig_05_01_pca_scree_biplot.png", 0.5, 1.55, 5.2, 2.85);
D.image(s, "fig_05_02_tsne_lle_pca_maps.png", 5.9, 1.55, 6.9, 2.85);
const cp = DR.comparison;
D.table(s, ["Method", "Runtime (s)", "Trustworthiness", "Silhouette"], ["PCA", "t-SNE", "LLE", "UMAP"].filter((k) => cp[k]).map((k) => [k, f(cp[k].runtime_s, 1), f(cp[k].trustworthiness_k10, 3), f(cp[k].silhouette_focus_genres, 3)]),
  0.5, 4.55, 6.6, [1.5, 1.6, 1.9, 1.6], 15);
D.bullets(s, [`PC1 ${pct(100 * DR.evr[0])}, PC2 ${pct(100 * DR.evr[1])}; ${DR.n90} PCs reach 90%`, "SVD of centred data reproduces PCA exactly", `KMeans k = ${DR.k_used}: named clusters such as "${DR.clusters["4"].name}"`],
  7.4, 4.5, 5.4, 2.2, 15);
s.addNotes(`PCA's first component is an electric-versus-acoustic axis and explains ${pct(100 * DR.evr[0])} of variance. On a stratified sample of 10,000 tracks, t-SNE preserves neighbourhoods best with trustworthiness ${f(cp["t-SNE"].trustworthiness_k10, 2)}. Silhouette by genre is slightly negative for every method, which tells us genres overlap in Spotify's feature space.`);

// 9 Status and plan
s = D.content(pres, "Analysis core is complete; the website is the main remaining build", "Module status and work plan");
STATUS.modules.forEach((m, i) => {
  const y = 1.75 + i * 0.52;
  s.addText(m.name, { x: 0.5, y, w: 4.2, h: 0.42, fontSize: 16, color: D.COL.ink, margin: 0, valign: "middle", isTextBox: true });
  s.addShape("roundRect", { x: 4.8, y: y + 0.08, w: 5.5, h: 0.28, fill: { color: D.COL.tint }, line: { color: D.COL.tint }, rectRadius: 0.06 });
  if (m.pct > 0) s.addShape("roundRect", { x: 4.8, y: y + 0.08, w: Math.max(0.15, 5.5 * m.pct / 100), h: 0.28, fill: { color: m.pct === 100 ? D.COL.navy : D.COL.amber }, line: { color: m.pct === 100 ? D.COL.navy : D.COL.amber }, rectRadius: 0.06 });
  s.addText(`${m.pct}%  ${m.state}`, { x: 10.5, y, w: 2.4, h: 0.42, fontSize: 14, color: D.COL.muted, margin: 0, valign: "middle", isTextBox: true });
});
s.addNotes("Here is our honest status. Data, cleaning, descriptive statistics, multivariate plots, dimensionality reduction, time series and hypothesis tests are complete. The website and the remaining notebooks are in progress, and the final report and paper follow.");

// 10 Next steps + refs
s = D.content(pres, "Next: finish the website, lyrics, network and the IEEE paper", "Next steps and key references");
D.card(s, 0.5, 1.7, 5.9, 4.9, "Next steps", "", {});
D.bullets(s, STATUS.next, 0.7, 2.3, 5.5, 4.2, 16);
const keyIds = ["serra2012evolution", "interiano2018trends", "hutto2014vader", "vandermaaten2008tsne", "dasilva2025parkinson"];
const refs = keyIds.map((id) => LIT.papers.findIndex((p) => p.id === id)).filter((i) => i >= 0).map((i) => `[${i + 1}] ${D.cite(LIT.papers[i])}, ${LIT.papers[i].title}`);
refs.push(`Kaggle datasets: rodolfofigueroa/spotify-12m-songs; maharshipandya/-spotify-tracks-dataset; carlosgdcj/genius-song-lyrics-with-language-information`);
s.addText("Key references", { x: 6.8, y: 1.7, w: 6, h: 0.45, fontSize: 20, bold: true, color: D.COL.ink, margin: 0, isTextBox: true });
s.addText(refs.map((t, i) => ({ text: t, options: { breakLine: i < refs.length - 1 } })), { x: 6.8, y: 2.25, w: 6.0, h: 4.4, fontSize: 14, color: D.COL.ink, paraSpaceAfter: 6, margin: 0, valign: "top", isTextBox: true });
s.addNotes("Our next steps are to complete the website pages, finish the lyrics and network analysis, run the automated profiling tools, and write the IEEE paper. These are some of the key papers we built on. Thank you; we are happy to take questions.");

const out = path.join(D.ROOT, "deliverables", `${D.PREFIX}_Review2_PPT.pptx`);
pres.writeFile({ fileName: out }).then(() => console.log("wrote", out));
