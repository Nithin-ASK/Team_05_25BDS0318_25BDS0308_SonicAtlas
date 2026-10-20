// Runs Lighthouse against `vite preview` (must be running on :4173).
// chrome-launcher cannot spawn Chrome on this Windows/Node 24 setup, so Chrome is
// launched by Playwright with a remote-debugging port and Lighthouse attaches to it.
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import fs from 'node:fs';

const PORT = 9333;
const pages = [['home', ''], ['query_studio', 'query'], ['compare', 'compare'], ['about', 'about']];
const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`], headless: true });
fs.mkdirSync('lighthouse', { recursive: true });
const summary = {};
for (const [name, route] of pages) {
  const url = `http://localhost:4173/#/${route}`;
  const r = await lighthouse(url, { port: PORT, output: ['json', 'html'], logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] }, desktopConfig);
  fs.writeFileSync(`lighthouse/${name}.report.json`, r.report[0]);
  fs.writeFileSync(`lighthouse/${name}.report.html`, r.report[1]);
  summary[name] = Object.fromEntries(Object.entries(r.lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
  const failing = Object.values(r.lhr.audits).filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary').map((a) => a.id);
  console.log(name, JSON.stringify(summary[name]), 'failing binary audits:', failing.join(', '));
}
fs.writeFileSync('lighthouse/summary.json', JSON.stringify(summary, null, 2));
await browser.close();
