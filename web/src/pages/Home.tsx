import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { ArrowRight, TerminalSquare, Map, GitCompare, Clock, Cpu, ShieldCheck, Share2 } from 'lucide-react';
import { Card, CardHeader, Stat, Skeleton, EmptyState, fmtInt } from '../components/ui';
import { Chart, useChartColors } from '../components/Chart';
import { useSummary, get, clusterNames, clusterLabel } from '../lib/data';
import { useSqlColumns } from '../lib/hooks';
import { SYMBOLS, SYMBOL_GLYPH } from '../lib/palette';

function MiniMap({ names }: { names: Record<number, string> }) {
  const q = useSqlColumns('SELECT pc1, pc2, cluster FROM tracks_lite USING SAMPLE reservoir(5000 ROWS) REPEATABLE (42)');
  const c = useChartColors();
  const option = useMemo(() => {
    if (q.status !== 'ready') return null;
    const { pc1, pc2, cluster } = q.data.cols;
    const groups: Record<number, number[][]> = {};
    for (let i = 0; i < pc1.length; i++) {
      const k = Number(cluster[i]);
      (groups[k] ??= []).push([pc1[i], pc2[i]]);
    }
    const keys = Object.keys(groups).map(Number).sort((a, b) => a - b);
    return {
      grid: { left: 8, right: 8, top: 8, bottom: 64, containLabel: false },
      legend: { bottom: 0, itemWidth: 10, itemHeight: 10, itemGap: 8, textStyle: { fontSize: 10 } },
      tooltip: { trigger: 'item', formatter: (p: any) => `${p.seriesName}<br/>PC1 ${p.value[0].toFixed(2)}, PC2 ${p.value[1].toFixed(2)}` },
      xAxis: { type: 'value', show: false, scale: true },
      yAxis: { type: 'value', show: false, scale: true },
      series: keys.map((k, i) => ({
        name: clusterLabel(names, k),
        type: 'scatter',
        data: groups[k],
        symbol: SYMBOLS[i % SYMBOLS.length],
        symbolSize: 4,
        itemStyle: { color: c.palette[i % c.palette.length], opacity: 0.7 },
        large: true,
        largeThreshold: 2000,
      })),
    };
  }, [q, names, c]);
  if (q.status === 'error') return <EmptyState title="Map unavailable" icon="data">The track sample could not be loaded yet.</EmptyState>;
  if (!option) return <Skeleton className="h-[340px]" label="Loading acoustic map" />;
  return <Chart option={option} height={340} ariaLabel="Scatter plot of a 5,000-track sample on the first two principal components, coloured and shaped by acoustic cluster" />;
}

export default function Home() {
  const s = useSummary();
  const sum = s.status === 'ready' ? s.data : null;
  const names = clusterNames(sum);

  const nTracks = get<number>(sum, 'audit.a_rows');
  const nArtists = get<number>(sum, 'descriptive.n_artists');
  const yMin = get<number>(sum, 'audit.a_year_min');
  const yMax = get<number>(sum, 'audit.a_year_max');
  const nGenres = get<number>(sum, 'audit.g_genres');

  const l50 = get<number>(sum, 'timeseries.loudness_1950s');
  const l10 = get<number>(sum, 'timeseries.loudness_2010s');
  const rAc = get<number>(sum, 'timeseries.corr_with_year.acousticness');
  const rEn = get<number>(sum, 'timeseries.corr_with_year.energy');
  const ex = get<Record<string, number>>(sum, 'descriptive.explicit_pct_by_decade', {});
  const exKeys = Object.keys(ex).sort();
  const exFirst = exKeys[0], exLast = exKeys[exKeys.length - 1];
  const anova = get<any>(sum, 'tests.anova');

  const findings = sum ? [
    l50 !== undefined && l10 !== undefined && {
      title: 'The loudness war is real',
      body: `Mean loudness rose from ${l50.toFixed(1)} dB in the 1950s to ${l10.toFixed(1)} dB in the 2010s (+${(l10 - l50).toFixed(1)} dB). Yearly mean energy correlates with year at r = ${rEn?.toFixed(2)}; acousticness at r = ${rAc?.toFixed(2)}.`,
      to: '/time?f=["loudness","energy","acousticness"]', cta: 'Open Time Machine',
    },
    exFirst && {
      title: 'Explicit lyrics went mainstream',
      body: `${ex[exFirst].toFixed(1)}% of ${exFirst}s tracks are flagged explicit, versus ${ex[exLast].toFixed(1)}% of ${exLast}s tracks (${get<number>(sum, 'descriptive.explicit_pct_all', 0).toFixed(1)}% overall).`,
      to: '/query?sql=' + encodeURIComponent('SELECT decade, ROUND(100 * AVG(explicit::INT), 2) AS explicit_pct, COUNT(*) AS n\nFROM tracks GROUP BY decade ORDER BY decade'), cta: 'Query it',
    },
    anova && {
      title: 'Genre explains danceability',
      body: `A one-way ANOVA across ${anova.k} genres (N = ${fmtInt(anova.N)}) gives F(${anova.df_between}, ${anova.df_within}) = ${anova.F.toFixed(1)}, eta squared = ${anova.eta_squared.toFixed(3)}: about ${(anova.eta_squared * 100).toFixed(0)}% of the variance in danceability is between genres.`,
      to: '/compare?by=genre&g=["classical","hip-hop","pop"]&f=danceability', cta: 'Compare genres',
    },
  ].filter(Boolean) as { title: string; body: string; to: string; cta: string }[] : [];

  return (
    <div className="space-y-8">
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-subtle">
            <Cpu className="h-3.5 w-3.5 text-accent" aria-hidden /> SQL runs in your browser - DuckDB-WASM + Parquet, no server
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Explore a century of music,<br className="hidden sm:block" /> <span className="text-accent">one audio feature at a time.</span>
          </h1>
          <p className="lead mt-4 max-w-xl">
            SonicAtlas is an exploratory data analysis studio for Spotify audio features. Filter and query a 150,000-track sample with SQL,
            compare groups with live hypothesis tests, map the acoustic space, and trace how music changed over time.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/query" className="btn-primary px-5 py-2.5"><TerminalSquare className="h-4 w-4" aria-hidden /> Start exploring</Link>
            <Link to="/map" className="btn-secondary px-5 py-2.5"><Map className="h-4 w-4" aria-hidden /> Acoustic map</Link>
            <Link to="/compare" className="btn-secondary px-5 py-2.5"><GitCompare className="h-4 w-4" aria-hidden /> Compare groups</Link>
          </div>
          <ul className="mt-6 grid gap-2 text-sm text-subtle sm:grid-cols-2">
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-ok" aria-hidden /> Private: your queries never leave the browser</li>
            <li className="flex items-center gap-2"><Share2 className="h-4 w-4 text-accent" aria-hidden /> Every view is a shareable URL</li>
          </ul>
        </div>
        <Card>
          <CardHeader title="Live acoustic map" subtitle="5,000 random tracks on the first two principal components, by KMeans cluster" actions={<Link className="btn-ghost btn-sm" to="/map">Open <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>} />
          <div className="p-3"><MiniMap names={names} /></div>
          {Object.keys(names).length > 0 && (
            <p className="sr-only">Cluster legend: {Object.entries(names).map(([k, v], i) => `${SYMBOL_GLYPH[i % 8]} ${k} ${v}`).join('; ')}</p>
          )}
        </Card>
      </section>

      <section aria-labelledby="stats-h">
        <h2 id="stats-h" className="sr-only">Dataset at a glance</h2>
        {s.status === 'loading' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : !sum ? (
          <Card><EmptyState title="Summary not available yet" icon="data">summary.json has not been exported yet.</EmptyState></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Tracks analysed" value={fmtInt(nTracks)} hint="Spotify 1.2M-song dataset" />
            <Stat label="Artists" value={fmtInt(nArtists)} hint="distinct main artists" />
            <Stat label="Years covered" value={yMin && yMax ? `${yMin}-${yMax}` : '-'} hint="release years" />
            <Stat label="Genres" value={fmtInt(nGenres)} hint="in the 114k genre-labelled table" />
          </div>
        )}
      </section>

      <section aria-labelledby="find-h">
        <h2 id="find-h" className="h2 mb-4">Three key findings</h2>
        {s.status === 'loading' ? (
          <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>
        ) : findings.length === 0 ? (
          <Card><EmptyState title="Findings will appear once summary.json is exported" icon="data" /></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {findings.map((f, i) => (
              <Card key={f.title} className="flex flex-col p-5">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 font-semibold text-accent">{i + 1}</div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-subtle">{f.body}</p>
                <Link to={f.to} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">{f.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="tools-h">
        <h2 id="tools-h" className="h2 mb-4">What you can do</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: '/query', icon: TerminalSquare, t: 'Query Studio', d: 'Visual filters, SQL console, plain-English queries, CSV / JSON / Parquet export.' },
            { to: '/twins', icon: Map, t: 'Sonic Twins', d: 'Find the nearest tracks to any song or target profile by cosine similarity.' },
            { to: '/compare', icon: GitCompare, t: 'Compare', d: 'Welch t, ANOVA and Mann-Whitney U with effect sizes, computed live.' },
            { to: '/time', icon: Clock, t: 'Time Machine', d: 'Yearly trends, change points, STL decomposition and animated decade means.' },
          ].map((x) => (
            <Link key={x.to} to={x.to} className="card group p-5 transition-colors hover:border-accent/60">
              <x.icon className="h-5 w-5 text-accent" aria-hidden />
              <h3 className="mt-3 font-semibold group-hover:text-accent">{x.t}</h3>
              <p className="mt-1 text-sm text-subtle">{x.d}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
