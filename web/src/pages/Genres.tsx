import { useMemo } from 'react';
import { Card, CardHeader, PageHeader, MultiSelect, Skeleton, DataMissing, EmptyState, Select } from '../components/ui';
import { Chart, useChartColors } from '../components/Chart';
import { useSql, useTable } from '../lib/hooks';
import { useGenreList } from '../lib/domains';
import { useUrlState } from '../lib/urlState';
import { useSummary, get } from '../lib/data';
import { PROFILE_FEATURES, FEATURE_LABEL, fmtFeature } from '../lib/features';
import { quoteString } from '../lib/sqlBuilder';
import { andrewsCurve, tGrid } from '../lib/andrews';
import { DASHES, SYMBOLS } from '../lib/palette';

const FALLBACK = ['classical', 'jazz', 'country', 'rock', 'metal', 'hip-hop', 'edm', 'pop'];
const short = (f: string) => FEATURE_LABEL[f].replace(/ \(.*\)/, '');

export default function Genres() {
  const status = useTable('genre_tracks');
  const all = useGenreList();
  const summary = useSummary();
  const focusDefault = get<string[]>(summary.status === 'ready' ? summary.data : null, 'multivariate.focus_genres', FALLBACK).slice(0, 5);
  const [sel, setSel] = useUrlState<string[] | null>('g', null);
  const [perGenre, setPerGenre] = useUrlState<string>('n', '80');
  const genres = (sel ?? focusDefault).slice(0, 8);
  const c = useChartColors();
  const inList = genres.map(quoteString).join(', ');

  const bounds = useSql(status === 'ready' ? `SELECT ${PROFILE_FEATURES.map((f) => `MIN(${f})::DOUBLE AS ${f}_min, MAX(${f})::DOUBLE AS ${f}_max`).join(', ')} FROM genre_tracks` : null, ['genre_tracks']);
  const means = useSql(status === 'ready' && genres.length ? `SELECT genre, COUNT(*) AS n, ${PROFILE_FEATURES.map((f) => `AVG(${f})::DOUBLE AS ${f}`).join(', ')} FROM genre_tracks WHERE genre IN (${inList}) GROUP BY genre` : null, ['genre_tracks']);
  const sample = useSql(status === 'ready' && genres.length ? `SELECT genre, name, artist, ${PROFILE_FEATURES.join(', ')} FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY genre ORDER BY hash(id)) AS rn FROM genre_tracks WHERE genre IN (${inList})
) WHERE rn <= ${Number(perGenre) || 80}` : null, ['genre_tracks']);

  const b = bounds.status === 'ready' ? bounds.data.rows[0] : null;
  const sc = (f: string, v: number) => (b ? (v - Number(b[`${f}_min`])) / ((Number(b[`${f}_max`]) - Number(b[`${f}_min`])) || 1) : v);
  const colorOf = (g: string) => c.palette[genres.indexOf(g) % 8];

  const parallel = useMemo(() => {
    if (sample.status !== 'ready') return null;
    const rows = sample.data.rows;
    return {
      legend: { bottom: 0, data: genres },
      tooltip: { trigger: 'item', formatter: (p: any) => `<b>${p.data?.label ?? ''}</b><br/>${p.seriesName}` },
      parallelAxis: PROFILE_FEATURES.map((f, i) => ({ dim: i, name: short(f), nameTextStyle: { color: c.subtle, fontSize: 11 }, axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c.subtle, fontSize: 10 }, scale: true })),
      parallel: { left: 40, right: 60, top: 40, bottom: 60, parallelAxisDefault: { areaSelectStyle: { width: 18, color: c.palette[0], opacity: 0.25 } } },
      series: genres.map((g) => ({
        name: g, type: 'parallel', smooth: false, progressive: 500,
        lineStyle: { color: colorOf(g), width: 1, opacity: 0.35, type: DASHES[genres.indexOf(g) % DASHES.length] as any },
        inactiveOpacity: 0.03, activeOpacity: 0.9,
        emphasis: { lineStyle: { width: 3, opacity: 1 } },
        data: rows.filter((r) => r.genre === g).map((r) => ({ value: PROFILE_FEATURES.map((f) => r[f] as number), label: `${r.name} - ${r.artist}` })),
      })),
    };
  }, [sample, genres, c]);

  const radar = useMemo(() => {
    if (means.status !== 'ready' || !b) return null;
    const rows = means.data.rows;
    return {
      legend: { bottom: 0 },
      tooltip: { trigger: 'item', formatter: (p: any) => { const r = rows.find((x) => x.genre === p.name); return r ? `<b>${p.name}</b> (n = ${r.n})<br/>` + PROFILE_FEATURES.map((f) => `${short(f)}: ${fmtFeature(f, r[f] as number)}`).join('<br/>') : ''; } },
      radar: { indicator: PROFILE_FEATURES.map((f) => ({ name: short(f), min: 0, max: 1 })), radius: '62%', axisName: { color: c.subtle }, splitLine: { lineStyle: { color: c.grid } }, splitArea: { show: false }, axisLine: { lineStyle: { color: c.grid } } },
      series: [{
        type: 'radar',
        data: genres.filter((g) => rows.some((r) => r.genre === g)).map((g) => {
          const r = rows.find((x) => x.genre === g)!;
          const i = genres.indexOf(g);
          return { name: g, value: PROFILE_FEATURES.map((f) => Number(sc(f, r[f] as number).toFixed(3))), lineStyle: { color: colorOf(g), width: 2, type: DASHES[i % DASHES.length] as any }, itemStyle: { color: colorOf(g) }, symbol: SYMBOLS[i % 8], areaStyle: { opacity: 0.06 } };
        }),
      }],
    };
  }, [means, b, genres, c]);

  const andrews = useMemo(() => {
    if (sample.status !== 'ready' || means.status !== 'ready' || !b) return null;
    const ts = tGrid(90);
    const rows = sample.data.rows;
    const lines: any[] = [];
    const meanLines: any[] = [];
    genres.forEach((g, gi) => {
      const rs = rows.filter((r) => r.genre === g).slice(0, 30);
      lines.push({
        name: g, type: 'lines', coordinateSystem: 'cartesian2d', polyline: true, silent: true,
        lineStyle: { color: colorOf(g), width: 0.7, opacity: 0.22 },
        data: rs.map((r) => { const ys = andrewsCurve(PROFILE_FEATURES.map((f) => sc(f, r[f] as number)), ts); return { coords: ts.map((t, i) => [t, ys[i]]) }; }),
      });
      const m = means.data.rows.find((x) => x.genre === g);
      if (m) {
        const ys = andrewsCurve(PROFILE_FEATURES.map((f) => sc(f, m[f] as number)), ts);
        meanLines.push({ name: g, type: 'line', showSymbol: false, data: ts.map((t, i) => [t, ys[i]]), lineStyle: { color: colorOf(g), width: 3, type: DASHES[gi % DASHES.length] as any }, itemStyle: { color: colorOf(g) }, z: 5 });
      }
    });
    return {
      grid: { left: 50, right: 20, top: 20, bottom: 70 },
      legend: { bottom: 0, data: genres },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => v?.toFixed(3) },
      xAxis: { type: 'value', min: -Math.PI, max: Math.PI, name: 't', nameLocation: 'middle', nameGap: 24, axisLabel: { formatter: (v: number) => (Math.abs(v - Math.PI) < 1e-6 ? 'pi' : Math.abs(v + Math.PI) < 1e-6 ? '-pi' : v.toFixed(1)) } },
      yAxis: { type: 'value', name: 'f(t)', nameLocation: 'middle', nameGap: 34 },
      series: [...lines, ...meanLines],
    };
  }, [sample, means, b, genres, c]);

  if (status === 'missing') return <><PageHeader kicker="Genre Fingerprints" title="What does a genre sound like?" /><Card><DataMissing file="genre_tracks.parquet" /></Card></>;

  return (
    <div>
      <PageHeader kicker="Genre Fingerprints" title="What does a genre sound like?">
        The genre-labelled table has {all ? all.length : '...'} genres. Compare up to eight of them with parallel coordinates (drag along an axis to brush),
        radar profiles of genre means, and Andrews curves computed in the browser.
      </PageHeader>
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4 px-5 py-4">
          <div className="w-full max-w-xl"><MultiSelect label="Genres (up to 8)" options={all ?? []} value={genres} onChange={setSel} max={8} /></div>
          <Select className="w-44" label="Tracks per genre" value={perGenre} onChange={setPerGenre} options={['40', '80', '150', '300'].map((v) => ({ value: v, label: v }))} />
        </div>
      </Card>
      {genres.length === 0 ? <Card><EmptyState title="Pick at least one genre" /></Card> : (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Parallel coordinates" subtitle={`${perGenre} deterministic-sample tracks per genre; raw feature values; drag on any axis to brush, click the legend to toggle`} />
            <div className="p-3">{parallel ? <Chart option={parallel} height={460} ariaLabel="Parallel coordinates plot of audio features by genre" /> : <Skeleton className="h-[460px]" />}</div>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Radar fingerprints" subtitle="Genre means scaled by the min / max of the whole genre table" />
              <div className="p-3">{radar ? <Chart option={radar} height={420} ariaLabel="Radar chart of genre mean audio features" /> : <Skeleton className="h-[420px]" />}</div>
            </Card>
            <Card>
              <CardHeader title="Andrews curves" subtitle="30 tracks per genre (thin) and the genre mean curve (bold); f(t) = x1/sqrt(2) + x2 sin t + x3 cos t + ..." />
              <div className="p-3">{andrews ? <Chart option={andrews} height={420} ariaLabel="Andrews curves by genre" /> : <Skeleton className="h-[420px]" />}</div>
            </Card>
          </div>
          {means.status === 'ready' && (
            <Card>
              <CardHeader title="Genre means" subtitle="All tracks of each genre in the genre table" />
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-max text-sm">
                  <caption className="sr-only">Mean audio features per genre</caption>
                  <thead><tr className="text-xs text-subtle"><th scope="col" className="px-2 py-1.5 text-left">Genre</th><th scope="col" className="px-2 text-right">n</th>{PROFILE_FEATURES.map((f) => <th key={f} scope="col" className="px-2 text-right">{short(f)}</th>)}</tr></thead>
                  <tbody>
                    {means.data.rows.sort((x, y) => genres.indexOf(String(x.genre)) - genres.indexOf(String(y.genre))).map((r) => (
                      <tr key={String(r.genre)} className="border-t border-border">
                        <th scope="row" className="px-2 py-1.5 text-left font-medium"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(String(r.genre)) }} aria-hidden />{String(r.genre)}</th>
                        <td className="px-2 text-right font-mono text-xs">{String(r.n)}</td>
                        {PROFILE_FEATURES.map((f) => <td key={f} className="px-2 text-right font-mono text-xs">{fmtFeature(f, r[f] as number)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
