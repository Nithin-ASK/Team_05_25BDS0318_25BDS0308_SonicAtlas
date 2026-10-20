import { ExternalLink } from 'lucide-react';
import { Card, CardHeader, PageHeader, Skeleton, fmtInt, fmtNum } from '../components/ui';
import { useJSON, useSummary, get } from '../lib/data';
import { GITHUB_URL, RELEASES_URL, FULL_DATA_URL } from '../config';

const SOURCES = [
  { name: 'Spotify 1.2M+ Songs', url: 'https://www.kaggle.com/datasets/rodolfofigueroa/spotify-12m-songs', role: 'Main audio-feature table with release dates (1.2M tracks)', licence: 'Kaggle licence field: "Unknown" - used for non-commercial academic analysis' },
  { name: 'Spotify Tracks Dataset', url: 'https://www.kaggle.com/datasets/maharshipandya/-spotify-tracks-dataset', role: '114k tracks with 114 genre labels and popularity', licence: 'Open Database (database); contents (c) original authors' },
  { name: 'Genius Song Lyrics with Language Information', url: 'https://www.kaggle.com/datasets/carlosgdcj/genius-song-lyrics-with-language-information', role: 'Lyrics sample for n-grams and sentiment (aggregates only)', licence: 'Kaggle licence field: "Unknown" - lyric text is not redistributed' },
];

interface Lit { papers: { id: string; authors: string; title: string; venue: string; year: number; url?: string; doi?: string; why_it_matters?: string }[] }

export default function About() {
  const s = useSummary();
  const sum = s.status === 'ready' ? s.data : null;
  const lit = useJSON<Lit>('literature.json');
  const g = (p: string) => get<number>(sum, p);

  const steps = sum ? [
    `Audited both tables: ${fmtInt(g('audit.a_rows'))} x ${g('audit.a_cols')} (main) and ${fmtInt(g('audit.g_rows'))} x ${g('audit.g_cols')} (genre); ${fmtInt(g('audit.a_missing_total'))} missing cells in the main table.`,
    `Impossible values repaired: ${fmtInt(g('cleaning.tempo_zero_imputed'))} tempos of 0 BPM and ${fmtInt(g('cleaning.time_signature_zero_imputed'))} time signatures of 0 were set missing and imputed with MICE (iterative imputation).`,
    `Re-issues: the earliest release per normalised title + main artist is marked canonical (${fmtInt(g('cleaning.canonical_rows'))} canonical, ${fmtInt(g('cleaning.reissue_rows'))} re-issue rows); time trends use canonical rows only.`,
    `Genre table de-duplicated to ${fmtInt(g('cleaning.join.genre_unique_tracks'))} unique tracks; only ${fmtNum(g('cleaning.join.match_rate_pct'), 1)}% join to the main table (${fmtInt(g('cleaning.join.id_matches'))} by Spotify ID, ${fmtInt(g('cleaning.join.title_artist_matches'))} by title + artist).`,
    `Outliers flagged, never dropped: Isolation Forest (2% contamination) flags ${fmtInt(g('cleaning.iso_outliers'))} tracks (${fmtNum(g('cleaning.iso_pct'), 2)}%); flagged tracks have mean speechiness ${fmtNum(g('cleaning.iso_outlier_mean_speechiness'), 3)} vs ${fmtNum(g('cleaning.iso_inlier_mean_speechiness'), 3)} for inliers (mostly spoken word).`,
    `Release-date precision: ${fmtInt(g('cleaning.date_precision.day'))} day, ${fmtInt(g('cleaning.date_precision.month'))} month and ${fmtInt(g('cleaning.date_precision.year'))} year-only dates; ${fmtNum(g('timeseries.jan1_share_pct'), 1)}% of day-precision dates fall on 1 January and are excluded from the monthly series.`,
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader kicker="Methodology & About" title="How SonicAtlas was built">
        A course project for BACSE301 Exploratory Data Analysis, VIT Vellore (Team 05). Every number on this site is read from the exported data files or the analysis summary;
        nothing is typed in by hand.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Team" />
          <ul className="space-y-2 p-5 text-sm">
            <li><b>Sharvesh Prabhu</b> <span className="text-subtle">- 25BDS0318</span></li>
            <li><b>Nithin S</b> <span className="text-subtle">- 25BDS0308</span></li>
            <li className="pt-2 text-subtle">Course: BACSE301 Exploratory Data Analysis, VIT Vellore</li>
            <li className="text-subtle">Code licence: MIT. Data: see the licences of each source below.</li>
            <li className="flex flex-wrap gap-3 pt-2">
              <a className="inline-flex items-center gap-1 text-accent underline hover:no-underline" href={GITHUB_URL} target="_blank" rel="noopener">GitHub repository (placeholder) <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
              <a className="inline-flex items-center gap-1 text-accent underline hover:no-underline" href={RELEASES_URL} target="_blank" rel="noopener">Releases (full dataset) <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
            </li>
          </ul>
        </Card>
        <Card>
          <CardHeader title="Architecture" />
          <ul className="list-disc space-y-1.5 py-5 pl-9 pr-5 text-sm text-subtle">
            <li>Static site (Vite + React + TypeScript), hosted on GitHub Pages - no server, no API keys.</li>
            <li>DuckDB-WASM runs SQL in a Web Worker over Parquet files fetched from the same origin.</li>
            <li>The 150,000-track sample keeps every genre-labelled track and fills the rest with a seeded random sample of canonical releases.</li>
            <li>The full 1.2M-row file is a GitHub Release asset, read with HTTP range requests on demand (<code className="kbd">{FULL_DATA_URL}</code>).</li>
            <li>Charts: Apache ECharts with the Okabe-Ito colour-blind-safe palette; categories also differ by marker shape or dash pattern.</li>
            <li>Statistics (Tukey quartiles, G1 / G2, Welch t, ANOVA, Mann-Whitney U, incomplete-beta p-values) are implemented in TypeScript and unit-tested.</li>
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Data sources" />
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">Data sources</caption>
            <thead><tr className="text-left text-xs text-subtle"><th scope="col" className="px-2 py-1.5">Dataset</th><th scope="col" className="px-2">Used for</th><th scope="col" className="px-2">Licence</th></tr></thead>
            <tbody>
              {SOURCES.map((x) => (
                <tr key={x.url} className="border-t border-border align-top">
                  <th scope="row" className="px-2 py-2 text-left font-medium"><a className="text-accent underline hover:no-underline" href={x.url} target="_blank" rel="noopener">{x.name}</a></th>
                  <td className="px-2 py-2 text-subtle">{x.role}</td>
                  <td className="px-2 py-2 text-subtle">{x.licence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Cleaning steps" subtitle="Numbers from summary.json" />
          {s.status === 'loading' ? <Skeleton className="m-4 h-48" /> : steps.length ? (
            <ol className="list-decimal space-y-2 py-5 pl-9 pr-5 text-sm">{steps.map((t) => <li key={t}>{t}</li>)}</ol>
          ) : <p className="p-5 text-sm text-subtle">summary.json is not available yet.</p>}
        </Card>
        <Card>
          <CardHeader title="Statistical conventions" />
          <ul className="list-disc space-y-2 py-5 pl-9 pr-5 text-sm">
            <li><b>Variance</b> uses the sample (n - 1) denominator.</li>
            <li><b>Quartiles</b> are Tukey hinges: the medians of the lower and upper halves; for odd n the median belongs to both halves. For 4, 5, 5, 6, 6, 6, 7, 8, 9, 14 this gives Q1 = {get(sum, 'descriptive.tutorial.q1', '-')}, Q3 = {get(sum, 'descriptive.tutorial.q3', '-')} (pandas' linear interpolation would give {get(sum, 'descriptive.tutorial.q1_pandas', '-')} and {get(sum, 'descriptive.tutorial.q3_pandas', '-')}).</li>
            <li><b>Skewness G1</b> is the adjusted Fisher-Pearson coefficient sqrt(n(n-1))/(n-2) g1; <b>kurtosis G2</b> is the bias-corrected excess kurtosis. Tutorial values: G1 = {fmtNum(get(sum, 'descriptive.tutorial.g1'), 4)}, G2 = {fmtNum(get(sum, 'descriptive.tutorial.g2'), 4)}.</li>
            <li><b>Tests:</b> Welch's t (unequal variances), one-way ANOVA with eta squared, Mann-Whitney U with the tie-corrected normal approximation; alpha = 0.05. p-values use the regularized incomplete beta function.</li>
            <li><b>Similarity:</b> cosine similarity on min-max scaled features. <b>Seed</b> 42 for every random step.</li>
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Limitations" />
        <ul className="list-disc space-y-2 py-5 pl-9 pr-5 text-sm">
          <li>Spotify audio features are <b>model-derived estimates</b>, not measurements; their definitions and models are not public and may change.</li>
          <li>The catalogue is <b>biased toward recent years</b> (see the tracks-per-year chart in the Time Machine), so early decades rest on far fewer tracks.</li>
          <li>The genre join matches only about <b>{fmtNum(get(sum, 'cleaning.join.match_rate_pct'), 1)}%</b> of genre-labelled tracks, so genre x decade questions rest on {fmtInt(get(sum, 'cleaning.genre_tracks_with_year'))} tracks.</li>
          <li>Lyrics analysis is <b>English-only</b> and uses lexicon-based sentiment (VADER, TextBlob), which misses sarcasm and context.</li>
          <li>The 150k web sample is not a simple random sample: every genre-labelled track is kept. Use "Load full dataset" for population-level numbers.</li>
          <li>With very large samples almost every difference is statistically significant; effect sizes matter more than p-values.</li>
        </ul>
      </Card>

      <Card>
        <CardHeader title="Literature" subtitle="Verified references from the project report (literature.json)" />
        {lit.status === 'loading' ? <Skeleton className="m-4 h-40" /> : lit.status === 'missing' ? <p className="p-5 text-sm text-subtle">literature.json is not available yet.</p> : (
          <ol className="list-decimal space-y-2 py-5 pl-9 pr-5 text-sm">
            {lit.data.papers.map((p) => (
              <li key={p.id}>
                {p.authors} ({p.year}). <i>{p.title}</i>. {p.venue}.{' '}
                {(p.doi || p.url) && <a className="text-accent underline hover:no-underline" href={p.doi ? (p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`) : p.url} target="_blank" rel="noopener">link</a>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
