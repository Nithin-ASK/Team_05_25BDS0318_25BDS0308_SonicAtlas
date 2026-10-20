// Shared theme, layouts and helpers for all SonicAtlas decks (pptxgenjs).
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const ROOT = path.resolve(__dirname, "..");
const FIG = path.join(ROOT, "reports", "figures");
const R = JSON.parse(fs.readFileSync(path.join(ROOT, "reports", "results.json"), "utf8"));
const LIT = fs.existsSync(path.join(__dirname, "literature.json"))
  ? JSON.parse(fs.readFileSync(path.join(__dirname, "literature.json"), "utf8")) : { papers: [], software: [], venues: [] };
const LINKS = fs.existsSync(path.join(__dirname, "links.json")) ? JSON.parse(fs.readFileSync(path.join(__dirname, "links.json"), "utf8")) : {};
const TITLE = "SonicAtlas: An Interactive In-Browser EDA Platform for Spotify Audio Features and Lyrics Across Genres and Eras";
const PREFIX = "Team_05_25BDS0318_25BDS0308";

const COL = { navy: "1B1F3B", amber: "F2A541", ink: "1B1F3B", muted: "5B6178", tint: "EEF0F7", white: "FFFFFF", line: "C9CDDB" };
const FONT = "Calibri";

// number helpers
const n = (x, d = 0) => Number(x).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const f = (x, d = 3) => Number(x).toFixed(d);
const pct = (x, d = 1) => Number(x).toFixed(d) + "%";

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function newDeck(subject) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pres.title = TITLE;
  pres.author = "Sharvesh Prabhu (25BDS0318), Nithin S (25BDS0308)";
  pres.subject = subject;
  pres.company = "Vellore Institute of Technology, Vellore";
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
  const footer = { text: "Team 05  |  SonicAtlas  |  BACSE301 Exploratory Data Analysis", options: { x: 0.5, y: 7.05, w: 8, h: 0.3, fontSize: 10, color: COL.muted, fontFace: FONT } };
  pres.defineSlideMaster({
    title: "DARK", background: { color: COL.navy },
    slideNumber: { x: 12.3, y: 7.0, w: 0.6, h: 0.35, color: "C9CDDB", fontSize: 11, fontFace: FONT },
  });
  pres.defineSlideMaster({
    title: "CONTENT", background: { color: COL.white },
    objects: [{ text: { text: footer.text, options: footer.options } }],
    slideNumber: { x: 12.3, y: 7.0, w: 0.6, h: 0.35, color: COL.muted, fontSize: 11, fontFace: FONT },
  });
  return pres;
}

function content(pres, title, kicker) {
  const s = pres.addSlide({ masterName: "CONTENT" });
  if (kicker) s.addText(kicker.toUpperCase(), { x: 0.5, y: 0.3, w: 12, h: 0.35, fontSize: 13, bold: true, color: "B7791F", charSpacing: 2, margin: 0, isTextBox: true });
  s.addText(title, { x: 0.5, y: 0.62, w: 12.3, h: 0.85, fontSize: 30, bold: true, color: COL.ink, margin: 0, valign: "top", isTextBox: true });
  return s;
}

function image(s, file, x, y, maxW, maxH, opts = {}) {
  const p = path.join(FIG, file);
  const { w, h } = pngSize(p);
  let iw = maxW, ih = (maxW * h) / w;
  if (ih > maxH) { ih = maxH; iw = (maxH * w) / h; }
  const ox = opts.align === "left" ? x : x + (maxW - iw) / 2;
  s.addImage({ path: p, x: ox, y, w: iw, h: ih, altText: opts.alt || file });
  return { x: ox, y, w: iw, h: ih };
}

function card(s, x, y, w, h, title, body, opts = {}) {
  s.addShape("roundRect", { x, y, w, h, fill: { color: opts.fill || COL.tint }, line: { color: opts.fill || COL.tint }, rectRadius: 0.12 });
  if (title) s.addText(title, { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.45, fontSize: opts.titleSize || 18, bold: true, color: opts.titleColor || COL.ink, margin: 0, isTextBox: true });
  if (body) s.addText(body, { x: x + 0.2, y: y + (title ? 0.6 : 0.15), w: w - 0.4, h: h - (title ? 0.7 : 0.3), fontSize: opts.size || 16, color: opts.color || COL.ink, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 4 });
}

function stat(s, x, y, w, value, label, opts = {}) {
  s.addShape("roundRect", { x, y, w, h: 1.55, fill: { color: opts.fill || COL.tint }, line: { color: opts.fill || COL.tint }, rectRadius: 0.12 });
  s.addText(value, { x: x + 0.15, y: y + 0.12, w: w - 0.3, h: 0.75, fontSize: opts.size || 32, bold: true, color: opts.valueColor || COL.navy, margin: 0, isTextBox: true });
  s.addText(label, { x: x + 0.15, y: y + 0.85, w: w - 0.3, h: 0.62, fontSize: 14, color: COL.muted, margin: 0, valign: "top", isTextBox: true });
}

function bullets(s, items, x, y, w, h, size = 17) {
  const arr = items.map((t, i) => {
    const parts = Array.isArray(t) ? t : [t];
    return parts.map((p, j) => ({ text: typeof p === "string" ? p : p.text, options: Object.assign({ bullet: j === 0 ? { indent: 18 } : false, breakLine: j === parts.length - 1 && i < items.length - 1 }, typeof p === "string" ? {} : p.options) }));
  }).flat();
  s.addText(arr, { x, y, w, h, fontSize: size, color: COL.ink, valign: "top", paraSpaceAfter: 8, margin: 0, isTextBox: true });
}

function table(s, header, rows, x, y, w, colW, size = 14) {
  const hdr = header.map((t) => ({ text: t, options: { bold: true, color: COL.white, fill: { color: COL.navy }, fontSize: size } }));
  const body = rows.map((r, i) => r.map((t) => ({ text: String(t), options: { fontSize: size, color: COL.ink, fill: { color: i % 2 ? COL.white : COL.tint } } })));
  s.addTable([hdr, ...body], { x, y, w, colW, border: { type: "solid", pt: 0.5, color: COL.line }, fontFace: FONT, margin: 0.05, valign: "middle" });
}

function titleSlide(pres, stage, date) {
  const s = pres.addSlide({ masterName: "DARK" });
  s.addText("SONICATLAS", { x: 0.7, y: 0.6, w: 6, h: 0.5, fontSize: 18, bold: true, color: COL.amber, charSpacing: 6, margin: 0, isTextBox: true });
  s.addText("An Interactive In-Browser EDA Platform for Spotify Audio Features and Lyrics Across Genres and Eras",
    { x: 0.7, y: 1.2, w: 8.2, h: 2.0, fontSize: 32, bold: true, color: COL.white, margin: 0, valign: "top", isTextBox: true });
  s.addText(stage, { x: 0.7, y: 3.4, w: 8.3, h: 0.5, fontSize: 22, color: COL.amber, bold: true, margin: 0, isTextBox: true });
  s.addText([
    { text: "Team 05", options: { bold: true, breakLine: true } },
    { text: "25BDS0318  Sharvesh Prabhu", options: { breakLine: true } },
    { text: "25BDS0308  Nithin S", options: { breakLine: true } },
  ], { x: 0.7, y: 4.1, w: 6, h: 1.3, fontSize: 18, color: COL.white, margin: 0, valign: "top", isTextBox: true });
  s.addText([
    { text: "BACSE301 Exploratory Data Analysis (Project-based Course)", options: { breakLine: true } },
    { text: "Faculty: ____________", options: { breakLine: true } },
    { text: "School of Computer Science and Engineering, VIT Vellore  |  " + date },
  ], { x: 0.7, y: 5.6, w: 9, h: 1.1, fontSize: 15, color: "C9CDDB", margin: 0, valign: "top", isTextBox: true });
  // visual: real t-SNE map from the project
  const p = path.join(FIG, "fig_05_05_clusters_on_tsne.png");
  s.addShape("roundRect", { x: 9.2, y: 1.2, w: 3.6, h: 3.6, fill: { color: COL.white }, line: { color: COL.white }, rectRadius: 0.15 });
  const sz = pngSize(p); const h = 3.3, w = (h * sz.w) / sz.h;
  s.addImage({ path: p, x: 9.2 + (3.6 - Math.min(w, 3.3)) / 2, y: 1.35, w: Math.min(w, 3.3), h: Math.min(w, 3.3) * sz.h / sz.w, altText: "Acoustic cluster map" });
  s.addText("Real acoustic map of 10,000 tracks (t-SNE)", { x: 9.2, y: 4.9, w: 3.6, h: 0.4, fontSize: 12, color: "C9CDDB", align: "center", margin: 0, isTextBox: true });
  return s;
}

function cite(p) {
  const a = (p.authors || "").split(",")[0].trim();
  const etal = (p.authors || "").split(",").length > 1 ? " et al." : "";
  return `${a}${etal} (${p.year})`;
}

module.exports = { pptxgen, newDeck, content, image, card, stat, bullets, table, titleSlide, cite, R, LIT, LINKS, COL, FONT, FIG, ROOT, PREFIX, TITLE, n, f, pct, pngSize };
