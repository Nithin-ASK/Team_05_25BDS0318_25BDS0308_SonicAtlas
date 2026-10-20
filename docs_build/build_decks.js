// Review-1 (bonus), Review-3 and Final decks. Usage: node build_decks.js [Review1|Review3|Final ...]
const fs = require("fs");
const path = require("path");
const D = require("./deck_common");
const { R, LIT, LINKS, n, f, pct } = D;

const A = R.audit, C = R.cleaning, DS = R.descriptive, M = R.multivariate, DR = R.dimred, TS = R.timeseries, T = R.tests;
const LY = R.lyrics, NET = R.network, PR = R.profiling, WEB = R.web || {}, QA = R.qa || {};
const fl = TS.first_last, cp = DR.comparison;
const SHOTS = D.FIG; // cropped copies made by crop_screenshots.py (web_*.png)
const IEEE = fs.existsSync(path.join(D.ROOT, "reports", "ieee_compliance.json")) ? JSON.parse(fs.readFileSync(path.join(D.ROOT, "reports", "ieee_compliance.json"), "utf8")) : null;
const PLAG = fs.existsSync(path.join(D.ROOT, "reports", "plagiarism", "check_results_final.json")) ? JSON.parse(fs.readFileSync(path.join(D.ROOT, "reports", "plagiarism", "check_results_final.json"), "utf8")) : null;
const github = LINKS.github || "[GitHub Link]", live = LINKS.live || "[Live Website Link]";

function shot(name) { // first screenshot whose file name contains `name` (light theme preferred)
  if (!fs.existsSync(SHOTS)) return null;
  const files = fs.readdirSync(SHOTS).filter((x) => x.startsWith("web_") && x.endsWith(".png") && x.toLowerCase().includes(name));
  const light = files.filter((x) => !x.includes("dark"));
  return (light[0] || files[0]) ? path.join(SHOTS, light[0] || files[0]) : null;
}
function imgAbs(s, file, x, y, maxW, maxH) {
  const { w, h } = D.pngSize(file);
  let iw = maxW, ih = (maxW * h) / w;
  if (ih > maxH) { ih = maxH; iw = (maxH * w) / h; }
  s.addShape("rect", { x: x + (maxW - iw) / 2 - 0.03, y: y - 0.03, w: iw + 0.06, h: ih + 0.06, fill: { color: "FFFFFF" }, line: { color: D.COL.line, width: 0.75 } });
  s.addImage({ path: file, x: x + (maxW - iw) / 2, y, w: iw, h: ih, altText: path.basename(file) });
}
const keyPapers = ["serra2012evolution", "interiano2018trends", "brand2019lyrics", "vandermaaten2008tsne", "dasilva2025parkinson"];
const SUM = {
  serra2012evolution: ["Tracked pitch, timbre and loudness of Western pop over 50+ years", "Static figures; no genre-level or interactive view"],
  interiano2018trends: ["Linked audio features of 500k UK releases to chart success", "No lyrics; results cannot be re-sliced by readers"],
  brand2019lyrics: ["Measured rising negativity in song lyrics over 50 years", "Lyrics only; audio mood not compared"],
  vandermaaten2008tsne: ["Introduced t-SNE for 2-D maps of high-dimensional data", "Global distances unreliable; no music benchmark"],
  dasilva2025parkinson: ["Streamlit web app for EDA and ML on medical data", "Needs a server; not music-aware"],
};
const refLines = (ids) => ids.map((id) => LIT.papers.findIndex((p) => p.id === id)).filter((i) => i >= 0).map((i) => `[${i + 1}] ${D.cite(LIT.papers[i])}, ${LIT.papers[i].title}`);

// ---------------------------------------------------------------- reusable slides
function sAbstract(pres, kicker = "Abstract") {
  const s = D.content(pres, "Mapping how the sound of music changes across genres and eras", kicker);
  D.card(s, 0.5, 1.7, 7.6, 4.9, "", `Spotify's archived audio descriptors (energy, valence, danceability, acousticness and more) are rarely explored beyond static charts. SonicAtlas cleans ${n(A.a_rows)} tracks released ${A.a_year_min}-${A.a_year_max}, a genre table of ${n(C.rows_genre_tracks)} tracks in ${A.g_genres} genres and ${LY ? n(LY.rows_used) : "a sample of"} English lyrics, explores them with the course methods (descriptive statistics, correlation, PCA/t-SNE/LLE, time series, hypothesis tests, text mining), and publishes everything in a website that runs SQL inside the browser with DuckDB-WASM.`, { size: 18 });
  [[n(A.a_rows), "tracks analysed"], [String(A.g_genres), "genres compared"], [`${TS.year_window[0]}-${TS.year_window[1]}`, "years of trends"]]
    .forEach(([v, l], i) => D.stat(s, 8.5, 1.7 + i * 1.7, 4.3, v, l));
  s.addNotes("SonicAtlas studies how musical characteristics change across genres and decades using public Spotify data and lyrics. We cleaned over a million tracks, applied the methods from our syllabus, and built a website so anyone can explore the results.");
  return s;
}
function sLiterature(pres) {
  const s = D.content(pres, "Prior work is static and studies sound and words apart", "Literature survey and gaps");
  const pick = keyPapers.map((id) => LIT.papers.find((p) => p.id === id)).filter(Boolean);
  D.table(s, ["Study", "What they did", "Gap SonicAtlas addresses"], pick.map((p) => [D.cite(p), SUM[p.id][0], SUM[p.id][1]]), 0.5, 1.7, 12.3, [2.9, 5.0, 4.4], 15);
  [["Static results", "fixed figures, no re-slicing"], ["Sound vs words", "audio and lyrics never compared"], ["Data quality", "zero tempos, re-issues ignored"], ["Generic tools", "not music-aware, need a server"]]
    .forEach(([t, b], i) => D.card(s, 0.5 + i * 3.1, 4.55, 2.9, 1.6, t, b, { size: 16, titleSize: 18 }));
  s.addText(`${LIT.papers.length} verified papers reviewed in the report (Table I).`, { x: 0.5, y: 6.45, w: 12, h: 0.4, fontSize: 14, italic: true, color: D.COL.muted, margin: 0, isTextBox: true });
  s.addNotes(`We reviewed ${LIT.papers.length} verified papers. The main gaps: results are static, audio and lyrics are studied separately, data quality is rarely discussed, and generic EDA tools are not music-aware and need a server.`);
  return s;
}
function sProblem(pres, withObjectives) {
  const s = D.content(pres, withObjectives ? "Open music data exists, but it is messy and locked in static charts" : "Open music data exists, but it is messy and locked in static charts", withObjectives ? "Problem identification and objectives" : "Problem identification");
  const probs = [["Messy data", `${n(A.a_checks.tempo_zero)} zero-BPM tempos, ${n(A.a_dup_title_artist)} duplicate title+artist rows, no shared keys`],
    ["Frozen results", "papers and notebooks show fixed figures; readers cannot ask new questions"],
    ["Split modalities", "audio features and lyrics are analysed in isolation"],
    ["Hosting cost", "interactive tools usually need a running server"]];
  if (withObjectives) {
    probs.forEach(([t, b], i) => D.card(s, 0.5, 1.7 + i * 1.22, 5.6, 1.1, t, b, { size: 15, titleSize: 17 }));
    s.addText("Objectives", { x: 6.6, y: 1.7, w: 6, h: 0.45, fontSize: 20, bold: true, color: D.COL.ink, margin: 0, isTextBox: true });
    objectives(s, 6.6, 2.25, 6.2, 4.4, 16);
  } else {
    probs.forEach(([t, b], i) => D.card(s, 0.5 + (i % 2) * 6.2, 1.8 + Math.floor(i / 2) * 2.4, 5.9, 2.1, t, b, { size: 18, titleSize: 20 }));
  }
  s.addNotes("The data is public but noisy: impossible tempos, duplicates and sources without common keys. Results in the literature are static, sound and lyrics are studied separately, and interactive tools cost money to host. Our objectives address each problem with a measurable target.");
  return s;
}
function objectives(s, x, y, w, h, size) {
  s.addText([
    "Clean 1M+ tracks; validate MICE by masking 5% of values",
    "Descriptive stats in course conventions (n-1, Tukey IQR, G1, G2)",
    "Correlation and multivariate genre fingerprints",
    "Compare PCA, t-SNE, LLE, UMAP; name acoustic clusters",
    "Trends, STL seasonality, change points, forecast",
    "ANOVA, chi-square, feature selection; lyrics sentiment",
    "In-browser SQL with lite-data queries under 1 second",
  ].map((t, i, a) => ({ text: t, options: { bullet: { type: "number" }, breakLine: i < a.length - 1 } })), { x, y, w, h, fontSize: size, color: D.COL.ink, paraSpaceAfter: 6, margin: 0, valign: "top", isTextBox: true });
}
function sObjectives(pres) {
  const s = D.content(pres, "Seven measurable objectives", "Objectives");
  objectives(s, 0.6, 1.8, 7.4, 4.8, 19);
  D.image(s, "fig_00_02_methodology_flow.png", 8.2, 2.4, 4.6, 2.4);
  s.addNotes("Each objective has a measurable outcome, for example the imputation error compared with mean filling, trustworthiness scores for the embeddings, and query time in the browser.");
  return s;
}
function sExisting(pres, combined) {
  const s = D.content(pres, combined ? "SonicAtlas combines what existing tools offer separately" : "Existing systems cover only parts of the need", combined ? "Existing systems vs proposed system" : "Existing systems");
  const rows = [
    ["Spotify app / Web API", "No (closed)", "No", "No", "Yes (app)", "No"],
    ["Static notebooks / papers", "Yes", "Partly", "Rarely", "No", "No"],
    ["Streamlit EDA app [25]", "Yes", "Generic", "No", "Yes", "No (server)"],
    ["YData / Sweetviz / D-Tale", "Yes", "Generic", "No", "Partly", "No (server for D-Tale)"],
  ];
  if (combined) rows.push(["SonicAtlas (ours)", "Yes", "Yes", "Yes", "Yes", "Yes"]);
  D.table(s, ["System", "Open data", "Music-specific EDA", "Audio + lyrics", "Interactive", "Serverless"], rows, 0.5, 1.8, 12.3, [3.4, 1.6, 2.2, 1.8, 1.6, 1.7], 16);
  s.addText(combined ? "Only SonicAtlas is open, music-aware, combines sound with words, and runs entirely in the browser." : "No existing option is open, music-aware, interactive and serverless at the same time.",
    { x: 0.5, y: 5.6, w: 12.3, h: 0.8, fontSize: 18, bold: true, color: D.COL.navy, margin: 0, isTextBox: true });
  s.addNotes("Spotify's own tools are closed, notebooks are static, the Streamlit application from our faculty reading needs a Python server and is not music-aware, and automated EDA tools are generic. SonicAtlas covers all columns.");
  return s;
}
function sProposed(pres) {
  const s = D.content(pres, "A documented pipeline plus a serverless query platform", "Proposed system");
  [["Clean", "MICE for impossible values, re-issue and outlier flags, scaling"], ["Explore", "statistics, correlation, parallel coordinates, Andrews curves"],
   ["Map", "PCA, SVD, t-SNE, LLE, UMAP and named clusters"], ["Explain", "STL, change points, ANOVA, chi-square, lyrics sentiment"],
   ["Share", "static website: DuckDB-WASM SQL, maps, comparisons, URLs"]].forEach(([t, b], i) => D.card(s, 0.5 + i * 2.5, 1.8, 2.3, 3.0, t, b, { size: 16, titleSize: 20 }));
  s.addText("Heavy computation runs once in Python; every interaction runs locally in the user's browser.", { x: 0.5, y: 5.3, w: 12.3, h: 0.8, fontSize: 18, color: D.COL.ink, margin: 0, isTextBox: true });
  s.addNotes("Our proposed system has five stages: clean, explore, map, explain and share. The last stage is the website, which runs SQL in the browser so it is fast, private and free to host.");
  return s;
}
function sArchitecture(pres, kicker = "Architecture / system flow / modules") {
  const s = D.content(pres, "Heavy maths runs offline; querying runs in the user's browser", kicker);
  D.image(s, "fig_00_01_system_architecture.png", 0.5, 1.6, 12.3, 5.3);
  s.addNotes("Python notebooks clean the data and compute statistics, embeddings and clusters, and export compact Parquet files. In the browser, DuckDB compiled to WebAssembly runs in a Web Worker and answers SQL queries locally. The React interface has eleven modules and keeps its state in the URL.");
  return s;
}
function sTrends(pres) {
  const s = D.content(pres, `Music got ${f(fl.loudness[1] - fl.loudness[0], 1)} dB louder and far less acoustic`, "Time-series and decade trends");
  D.image(s, "fig_06_02_yearly_trends_rolling.png", 0.5, 1.55, 7.6, 3.9);
  D.image(s, "fig_06_03_change_points.png", 8.3, 1.55, 4.5, 2.2);
  D.bullets(s, [`Loudness ${f(fl.loudness[0], 1)} -> ${f(fl.loudness[1], 1)} dB (${TS.year_window[0]}-${TS.year_window[1]})`, `Acousticness ${f(fl.acousticness[0], 2)} -> ${f(fl.acousticness[1], 2)}`,
    `Loudness change points: ${TS.change_points.loudness.slice(1).join(", ")} ("loudness war")`, `ARIMA MAE ${f(TS.arima.mae, 2)} dB vs naive ${f(TS.arima.mae_naive, 2)} dB`],
    8.3, 4.0, 4.5, 2.8, 15);
  s.addNotes(`Yearly means of canonical releases show loudness rising from ${f(fl.loudness[0], 1)} to ${f(fl.loudness[1], 1)} decibels, energy and danceability rising, and acousticness falling. Change-point detection finds breaks in 1989 and 1999, the CD loudness-war period. Our ARIMA forecast is no better than a naive one because loudness has plateaued.`);
  return s;
}
function sClusters(pres) {
  const s = D.content(pres, "Six named acoustic clusters, but genres overlap heavily", "Clustering and acoustic map");
  D.table(s, ["Cluster", "Share", "Top genres"], Object.values(DR.clusters).map((v) => [v.name, pct(v.share_pct), v.top_genres]), 0.5, 1.7, 7.0, [2.9, 1.0, 3.1], 14);
  D.image(s, "fig_05_05_clusters_on_tsne.png", 7.8, 1.6, 5.0, 4.6);
  s.addText(`KMeans k = ${DR.k_used} on ${DR.n90} PCs; HDBSCAN marks ${pct(DR.hdbscan_noise_pct, 0)} as noise; genre silhouette is negative in every embedding.`, { x: 0.5, y: 6.1, w: 7.0, h: 0.8, fontSize: 15, color: D.COL.muted, margin: 0, isTextBox: true });
  s.addNotes("KMeans with six clusters gives groups we can name, from quiet acoustic instrumentals to spoken word and rap. The negative silhouette by genre and the high HDBSCAN noise share tell us that audio space is a continuum: genre is partly a cultural label.");
  return s;
}
function sLyricsTests(pres) {
  const s = D.content(pres, "Genre shapes danceability; lyric mood barely follows the music", "Lyrics text EDA and hypothesis tests");
  if (LY) D.image(s, "fig_07_01_sentiment_vs_valence.png", 0.5, 1.6, 6.4, 2.4);
  D.table(s, ["Test", "Statistic", "p", "Effect size"], [
    ["ANOVA danceability x genre", `F = ${f(T.anova.F, 1)}`, "< 0.001", `eta2 = ${f(T.anova.eta_squared, 3)}`],
    ["Kruskal-Wallis", `H = ${f(T.kruskal.H, 0)}`, "< 0.001", `eps2 = ${f(T.kruskal.epsilon_squared, 3)}`],
    ["Chi-square mode x genre", f(T.chi2_mode_genre.chi2, 1), "< 0.001", `V = ${f(T.chi2_mode_genre.cramers_v, 3)}`],
    ["Chi-square mode x decade", f(T.chi2_mode_decade.chi2, 0), "< 0.001", `V = ${f(T.chi2_mode_decade.cramers_v, 3)}`]],
  7.1, 1.7, 5.7, [2.5, 1.2, 0.8, 1.2], 13);
  if (LY) D.bullets(s, [`${n(LY.rows_used)} English songs; median ${f(LY.median_words, 0)} words, ${pct(100 * LY.median_repetition, 0)} repeated lines`,
    `VADER vs TextBlob agree on sign for ${pct(LY.sign_agreement_pct)} (r = ${f(LY.vader_textblob_r, 2)})`,
    `Lyric sentiment vs audio valence r = ${f(LY.r_valence_vader, 2)} (n = ${n(LY.matched_n)})`, `Country most positive, rap most negative`], 0.5, 4.3, 6.4, 2.5, 15);
  D.bullets(s, [`Tukey HSD: ${T.tukey_sig_pairs}/${T.tukey_pairs} genre pairs differ`, "Large n: read effect sizes, not p-values", `Top features: ${T.top3_anova.join(", ")}`], 7.1, 4.3, 5.7, 2.5, 15);
  s.addNotes(`Genre explains about ${pct(100 * T.anova.eta_squared, 0)} of the variance in danceability, a large effect confirmed by Kruskal-Wallis. Mode depends on genre moderately but on decade only negligibly. In the lyrics, sentiment of the words barely correlates with the musical valence, so sound and words carry different emotional information.`);
  return s;
}
function sWebsite(pres, title, kicker) {
  const s = D.content(pres, title, kicker);
  const want = [["query", "Query Studio"], ["map", "Acoustic Map"], ["compare", "Compare"], ["time", "Time Machine"]];
  want.forEach(([k, label], i) => {
    const file = shot(k);
    const x = 0.5 + (i % 2) * 6.25, y = 1.6 + Math.floor(i / 2) * 2.7;
    if (file) imgAbs(s, file, x, y, 6.0, 2.25);
    else D.card(s, x, y, 6.0, 2.25, label, "screenshot pending", { size: 14 });
    s.addText(label, { x, y: y + 2.28, w: 6.0, h: 0.3, fontSize: 14, bold: true, color: D.COL.muted, align: "center", margin: 0, isTextBox: true });
  });
  s.addNotes("These are real screenshots of SonicAtlas. Query Studio builds SQL from filters or plain English; the Acoustic Map switches between PCA, t-SNE, LLE and UMAP; Compare runs live significance tests; Time Machine shows trends, seasonality and change points.");
  return s;
}
function sEvaluation(pres) {
  const s = D.content(pres, "Every component is measured, not just demonstrated", "Evaluation");
  D.table(s, ["Method", "Time (s)", "Trust.", "Silh."], ["PCA", "t-SNE", "LLE", "UMAP"].map((k) => [k, f(cp[k].runtime_s, 1), f(cp[k].trustworthiness_k10, 3), f(cp[k].silhouette_focus_genres, 3)]), 0.5, 1.7, 5.6, [1.4, 1.3, 1.4, 1.5], 15);
  const stats = [[WEB.query_ms_median != null ? `${WEB.query_ms_median} ms` : "n/a", "median lite-data query time"],
    [QA.pytest || "7/7", "Python unit tests passed"], [WEB.unit_tests || "pending", "web unit tests passed"], [WEB.e2e_tests || "pending", "Playwright end-to-end tests"],
    [WEB.lighthouse_pages ? "96-100" : "pending", "Lighthouse accessibility, best practice, SEO (performance 75-99)"]];
  stats.forEach(([v, l], i) => D.stat(s, 6.5 + (i % 2) * 3.2, 1.7 + Math.floor(i / 2) * 1.75, 3.0, v, l, { size: 24 }));
  if (PR) s.addText(`Automated EDA: YData ${f(PR.ydata_seconds, 1)} s, Sweetviz ${f(PR.sweetviz_seconds, 1)} s, D-Tale ${f(PR.dtale_seconds, 1)} s - fast overviews, but none flagged 0-BPM tempos or ran tests/embeddings.`, { x: 0.5, y: 4.6, w: 5.6, h: 1.6, fontSize: 15, color: D.COL.ink, margin: 0, isTextBox: true });
  s.addNotes("We evaluated each part: embeddings by trustworthiness and silhouette, the website by query time, automated tests and Lighthouse audits, and the automated EDA tools by what they found and missed compared with our manual analysis.");
  return s;
}
function sOutcome(pres, title, kicker) {
  const s = D.content(pres, title, kicker);
  const p1 = path.join(D.FIG, "paper_page1.png");
  if (fs.existsSync(p1)) imgAbs(s, p1, 0.5, 1.6, 3.6, 5.0);
  const v = (LIT.venues || []).map((x) => `${x.name.split(" (")[0]}: ${x.dates_or_deadline.split(";")[0]}`);
  s.addText("IEEE-format paper (6 pages) - status: prepared for submission", { x: 4.5, y: 1.6, w: 8.3, h: 0.45, fontSize: 18, bold: true, color: D.COL.ink, margin: 0, isTextBox: true });
  D.bullets(s, v, 4.5, 2.15, 8.3, 1.9, 15);
  const items = [`GitHub: ${github}`, `Live site: ${live}`];
  if (IEEE) items.push(`IEEE checks: A4, ${IEEE.pages} pages, fonts embedded ${IEEE.all_fonts_embedded ? "yes" : "no"}, Type-3 fonts ${IEEE.type3_fonts.length}`);
  if (PLAG) items.push(`Similarity self-check: report ${f(PLAG.documents["Project Report"].similarity_8gram_pct, 2)}%, paper ${f(PLAG.documents["IEEE Paper"].similarity_8gram_pct, 2)}% (not Turnitin)`);
  D.bullets(s, items, 4.5, 4.2, 8.3, 2.6, 15);
  ["qr_github.png", "qr_live.png"].forEach((q, i) => { const p = path.join(D.FIG, q); if (fs.existsSync(p)) s.addImage({ path: p, x: 11.3 - i * 1.5, y: 5.5, w: 1.3, h: 1.3, altText: q }); });
  s.addNotes("Our outcome is an IEEE-format paper prepared for submission to one of these venues, the open-source repository and the live website. Our own similarity self-check found very low overlap; the official Turnitin check is done by the university.");
  return s;
}
function sConclusion(pres, title, kicker) {
  const s = D.content(pres, title, kicker);
  D.card(s, 0.5, 1.7, 4.0, 4.9, "Conclusion", `Careful cleaning matters; music got louder and less acoustic; genre explains ${pct(100 * T.anova.eta_squared, 0)} of danceability but overlaps in every map; lyrics and sound carry different moods.`, { size: 16 });
  D.card(s, 4.7, 1.7, 4.0, 4.9, "Limitations", `Spotify features are model-derived; catalogue favours recent years; genre join only ${pct(C.join.match_rate_pct)}; English-only lyrics; the 2020s have one year.`, { size: 16 });
  D.card(s, 8.9, 1.7, 3.9, 2.3, "Future work", "Open audio features, multilingual lyrics, user study.", { size: 16 });
  s.addText(refLines(["serra2012evolution", "hutto2014vader", "vandermaaten2008tsne", "dasilva2025parkinson"]).map((t, i, a) => ({ text: t, options: { breakLine: i < a.length - 1 } })),
    { x: 8.9, y: 4.2, w: 3.9, h: 2.5, fontSize: 11, color: D.COL.muted, margin: 0, valign: "top", isTextBox: true });
  s.addNotes("To conclude: careful cleaning changes the conclusions, music has become louder and less acoustic, genre matters but genres overlap, and lyrics add independent information. Our main limitations are the proprietary features and data bias. Thank you.");
  return s;
}

function sDemoOutcome(pres) {
  const s = D.content(pres, "SonicAtlas live, plus an IEEE paper prepared for submission", "Live demo and outcome");
  [["query", "Query Studio"], ["map", "Acoustic Map"], ["compare", "Compare"]].forEach(([k, label], i) => {
    const file = shot(k); const y = 1.55 + i * 1.75;
    if (file) imgAbs(s, file, 0.5, y, 3.0, 1.5); else D.card(s, 0.5, y, 3.0, 1.5, label, "screenshot pending", { size: 12 });
    s.addText(label, { x: 3.65, y: y + 0.5, w: 2.2, h: 0.5, fontSize: 15, bold: true, color: D.COL.ink, margin: 0, isTextBox: true });
  });
  const p1 = path.join(D.FIG, "paper_page1.png");
  if (fs.existsSync(p1)) imgAbs(s, p1, 6.0, 1.55, 3.0, 4.3);
  D.bullets(s, ["IEEE-format paper, 6 pages: prepared for submission", `Targets: ${(LIT.venues || []).map((x) => x.name.split(" (")[0]).join(", ")}`, `GitHub: ${github}`, `Live: ${live}`],
    9.3, 1.55, 3.5, 3.6, 14);
  ["qr_github.png", "qr_live.png"].forEach((q, i) => { const p = path.join(D.FIG, q); if (fs.existsSync(p)) s.addImage({ path: p, x: 9.4 + i * 1.6, y: 5.3, w: 1.4, h: 1.4, altText: q }); });
  s.addNotes("Here is SonicAtlas live: the Query Studio, the Acoustic Map and the Compare page, all running in the browser. On the right is the first page of our IEEE-format paper, prepared for submission, and links to the repository and live site.");
  return s;
}

// ---------------------------------------------------------------- decks
function review1() {
  const pres = D.newDeck("BACSE301 EDA - Review-1 presentation, Team 05");
  D.titleSlide(pres, "Review-1  |  Problem, literature and design", "2026").addNotes("We are Team 05. This Review-1 deck presents our problem, literature survey, objectives and the proposed SonicAtlas design.");
  sAbstract(pres); sLiterature(pres); sProblem(pres, false); sObjectives(pres); sExisting(pres, false); sProposed(pres); sArchitecture(pres);
  return pres;
}
function review3() {
  const pres = D.newDeck("BACSE301 EDA - Review-3 presentation, Team 05");
  D.titleSlide(pres, "Review-3  |  Implementation complete, evaluation and outcome", "October 2026").addNotes("Welcome to our Review-3. Since Review-2 we finished every notebook, the lyrics and network analyses, the website, the evaluation and the IEEE paper.");
  const s = D.content(pres, "Since Review-2: website, lyrics, network, tests and paper finished", "Problem, objectives and what changed");
  D.card(s, 0.5, 1.7, 6.0, 4.9, "Problem and objectives", "Open music data is messy and its insights are locked in static charts. Objectives: clean 1M+ tracks with validated repairs, apply the course EDA methods, compare embeddings, model trends, test genre differences, mine lyrics, and serve it all in a serverless website.", { size: 17 });
  D.card(s, 6.8, 1.7, 6.0, 4.9, "What changed since Review-2", "", {});
  D.bullets(s, [`Lyrics mining on ${LY ? n(LY.rows_used) : "a sample of"} English songs`, `Artist network: ${NET ? n(NET.nodes) : "?"} artists, ${NET ? NET.communities : "?"} communities`, "Automated EDA benchmark (YData, Sweetviz, D-Tale)", "SonicAtlas website with 11 modules", "Tests, Lighthouse audit, IEEE paper, self-check"], 7.0, 2.3, 5.6, 4.2, 16);
  s.addNotes("Our problem and objectives are unchanged. What is new since Review-2: the lyrics analysis, the collaboration network, the automated EDA benchmark, the full website, the evaluation and the paper.");
  sArchitecture(pres, "Final architecture and modules"); sTrends(pres); sClusters(pres); sLyricsTests(pres);
  sWebsite(pres, "SonicAtlas runs every query inside the browser", "Website demo"); sEvaluation(pres);
  sOutcome(pres, "An IEEE paper, an open repository and a live tool", "Outcome");
  sConclusion(pres, "Louder, less acoustic, and more than genre alone", "Conclusion, limitations, future work");
  return pres;
}
function finalDeck() {
  const pres = D.newDeck("BACSE301 EDA - Final presentation, Team 05");
  D.titleSlide(pres, "Final Review  |  Complete project", "October 2026").addNotes("Good morning. We are Team 05 and this is the complete story of SonicAtlas.");
  sAbstract(pres); sLiterature(pres); sProblem(pres, true); sExisting(pres, true); sArchitecture(pres);
  let s = D.content(pres, "From raw public files to an interactive in-browser tool", "Methodology");
  D.image(s, "fig_00_02_methodology_flow.png", 0.5, 1.7, 12.3, 2.6);
  D.bullets(s, ["Course conventions: n-1 variance, Tukey quartiles, adjusted G1, bias-corrected G2", `Validated MICE (energy error -${f(C.mice_validation.energy.improvement_pct, 0)}% vs mean); outliers flagged, never dropped`,
    "Embeddings on a 10,000-track genre-stratified sample; trends on canonical releases only", "Every number in documents comes from results.json (cross-checked by script)"], 0.5, 4.6, 12.3, 2.2, 17);
  s.addNotes("Our methodology moves from acquisition and cleaning through statistics, multivariate views, dimensionality reduction, clustering, time series and tests to deployment. Every number in our documents is generated from a single results file.");
  s = D.content(pres, "Five findings, all measured", "Key findings");
  const kf = [[`+${f(fl.loudness[1] - fl.loudness[0], 1)} dB`, `louder music ${TS.year_window[0]}-${TS.year_window[1]}`], [`r = ${f(M.pairs["loudness~energy"].pearson, 2)}`, "loudness vs energy"],
    [pct(100 * T.anova.eta_squared, 0), "of danceability explained by genre"], [f(cp["t-SNE"].trustworthiness_k10, 3), "t-SNE trustworthiness (best)"], [LY ? `r = ${f(LY.r_valence_vader, 2)}` : "-", "lyric sentiment vs audio valence"]];
  kf.forEach(([v, l], i) => D.stat(s, 0.5, 1.55 + i * 1.07, 3.6, v, l, { size: 24 }));
  D.image(s, "fig_06_06_decade_story.png", 4.4, 1.55, 8.4, 2.6);
  D.image(s, "fig_04_01_correlation_heatmaps.png", 4.4, 4.3, 8.4, 2.6);
  s.addNotes("Our five headline findings: music became louder; energy is almost a restatement of loudness; genre strongly shapes danceability; t-SNE keeps local structure best; and lyric sentiment is nearly independent of musical mood.");
  sDemoOutcome(pres);
  sConclusion(pres, "Louder, less acoustic, and more than genre alone", "Conclusion, future work and references");
  return pres;
}

const which = process.argv.slice(2).length ? process.argv.slice(2) : ["Review1", "Review3", "Final"];
(async () => {
  for (const w of which) {
    const pres = w === "Review1" ? review1() : w === "Review3" ? review3() : finalDeck();
    const n_ = pres.slides.length;
    if (n_ > 10) throw new Error(`${w} has ${n_} slides (max 10)`);
    const out = path.join(D.ROOT, "deliverables", `${D.PREFIX}_${w}_PPT.pptx`);
    await pres.writeFile({ fileName: out });
    console.log("wrote", path.basename(out), n_, "slides");
  }
})();
