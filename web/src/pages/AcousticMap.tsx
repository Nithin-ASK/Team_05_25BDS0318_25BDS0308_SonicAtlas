import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Card, CardHeader, PageHeader, Segmented, Select, Skeleton, MultiSelect, DataMissing, EmptyState, fmtNum } from '../components/ui';
import { Chart, useChartColors } from '../components/Chart';
import { DataTable } from '../components/DataTable';
import { useSqlColumns, useTable } from '../lib/hooks';
import { useUrlState } from '../lib/urlState';
import { useSummary, clusterNames, clusterLabel, get } from '../lib/data';
import { FEATURE_LABEL, PROFILE_FEATURES, fmtFeature } from '../lib/features';
import { SYMBOLS, SEQUENTIAL } from '../lib/palette';
import { escapeHtml } from '../lib/format';

type Method = 'pca' | 'tsne' | 'lle' | 'umap';
const METHODS: { value: Method; label: string; key: string }[] = [
  { value: 'pca', label: 'PCA', key: 'PCA' },
  { value: 'tsne', label: 't-SNE', key: 't-SNE' },
  { value: 'lle', label: 'LLE', key: 'LLE' },
  { value: 'umap', label: 'UMAP', key: 'UMAP' },
];

const COLOR_OPTS = [
  { value: 'cluster', label: 'KMeans cluster' },
  { value: 'genre', label: 'Genre (highlight up to 8)' },
  { value: 'decade', label: 'Decade (not available: sample has no year)' },
  ...[...PROFILE_FEATURES, 'popularity'].map((f) => ({ value: f, label: FEATURE_LABEL[f] ?? f })),
];

const DEFAULT_GENRES = ['classical', 'hip-hop', 'metal', 'jazz', 'edm', 'country'];

export default function AcousticMap() {
  const status = useTable('embeddings');
  const nav = useNavigate();
  const [method, setMethod] = useUrlState<Method>('m', 'tsne');
  const [colorBy, setColorBy] = useUrlState<string>('c', 'cluster');
  const [focus, setFocus] = useUrlState<string[]>('g', DEFAULT_GENRES);
  const [selected, setSelected] = useState<number[]>([]);
  const [clicked, setClicked] = useState<number | null>(null);
  const summary = useSummary();
  const sum = summary.status === 'ready' ? summary.data : null;
  const names = clusterNames(sum);
  const c = useChartColors();

  const q = useSqlColumns(status === 'ready'
    ? `SELECT id, name, artist, genre, popularity, cluster, ${PROFILE_FEATURES.join(', ')}, pca_x, pca_y, tsne_x, tsne_y, lle_x, lle_y, umap_x, umap_y FROM embeddings`
    : null, ['embeddings']);
  const data = q.status === 'ready' ? q.data : null;

  const genres = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.cols.genre.filter(Boolean) as string[])].sort();
  }, [data]);

  const effectiveColor = colorBy === 'decade' ? 'cluster' : colorBy;

  const option = useMemo(() => {
    if (!data) return null;
    const X = data.cols[`${method}_x`], Y = data.cols[`${method}_y`];
    const n = data.n;
    const base = {
      grid: { left: 40, right: 20, top: 20, bottom: 70 },
      xAxis: { type: 'value', scale: true, name: `${METHODS.find((m) => m.value === method)?.label} 1`, nameLocation: 'middle', nameGap: 24, splitLine: { show: false }, axisLine: { onZero: false } },
      yAxis: { type: 'value', scale: true, name: `${METHODS.find((m) => m.value === method)?.label} 2`, nameLocation: 'middle', nameGap: 28, splitLine: { show: false }, axisLine: { onZero: false } },
      toolbox: { right: 10, top: 0, feature: { brush: { type: ['rect', 'polygon', 'clear'], title: { rect: 'Box select', polygon: 'Lasso select', clear: 'Clear selection' } }, restore: { title: 'Reset zoom' } }, iconStyle: { borderColor: c.subtle } },
      brush: { toolbox: ['rect', 'polygon', 'clear'], xAxisIndex: 0, throttleType: 'debounce', throttleDelay: 250, brushStyle: { borderColor: c.palette[0], color: 'rgba(0,114,178,0.12)' } },
      dataZoom: [{ type: 'inside', xAxisIndex: 0 }, { type: 'inside', yAxisIndex: 0 }],
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          const i = p.value[p.value.length - 1];
          const feats = ['danceability', 'energy', 'valence', 'acousticness'].map((f) => `${FEATURE_LABEL[f]}: <b>${fmtFeature(f, data.cols[f][i])}</b>`).join('<br/>');
          return `<div style="max-width:240px"><b>${escapeHtml(String(data.cols.name[i]))}</b><br/><span style="opacity:.75">${escapeHtml(String(data.cols.artist[i]))}</span><br/>Genre: ${escapeHtml(String(data.cols.genre[i]))} &middot; ${escapeHtml(clusterLabel(names, data.cols.cluster[i]))}<br/>${feats}<br/><i style="opacity:.7">Click to find sonic twins</i></div>`;
        },
      },
    };
    if (effectiveColor === 'cluster' || effectiveColor === 'genre') {
      const groups = new Map<string, number[][]>();
      const order: string[] = [];
      for (let i = 0; i < n; i++) {
        let k: string;
        if (effectiveColor === 'cluster') k = clusterLabel(names, data.cols.cluster[i]);
        else k = focus.includes(String(data.cols.genre[i])) ? String(data.cols.genre[i]) : 'other genres';
        if (!groups.has(k)) { groups.set(k, []); order.push(k); }
        groups.get(k)!.push([X[i], Y[i], i]);
      }
      const keys = effectiveColor === 'cluster' ? [...order].sort() : [...focus.filter((g) => groups.has(g)), ...(groups.has('other genres') ? ['other genres'] : [])];
      return {
        ...base,
        legend: { bottom: 0, type: 'scroll' },
        series: keys.map((k, i) => ({
          name: k, type: 'scatter', data: groups.get(k), symbol: k === 'other genres' ? 'circle' : SYMBOLS[i % SYMBOLS.length],
          symbolSize: k === 'other genres' ? 3 : 5, large: true, largeThreshold: 4000, progressive: 2000,
          itemStyle: { color: k === 'other genres' ? (c.dark ? '#3a4458' : '#d1d5db') : c.palette[i % c.palette.length], opacity: k === 'other genres' ? 0.5 : 0.8 },
          z: k === 'other genres' ? 1 : 2,
        })),
      };
    }
    const vals = data.cols[effectiveColor] as number[];
    let lo = Infinity, hi = -Infinity;
    for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return {
      ...base,
      visualMap: { min: lo, max: hi, dimension: 2, orient: 'horizontal', left: 'center', bottom: 0, calculable: true, inRange: { color: SEQUENTIAL }, text: [fmtFeature(effectiveColor, hi), fmtFeature(effectiveColor, lo)], textStyle: { color: c.subtle } },
      series: [{ name: FEATURE_LABEL[effectiveColor] ?? effectiveColor, type: 'scatter', data: Array.from({ length: n }, (_, i) => [X[i], Y[i], vals[i], i]), symbolSize: 4, large: true, largeThreshold: 20000, progressive: 4000 }],
    };
  }, [data, method, effectiveColor, focus, names, c]);

  const onEvents = useMemo(() => ({
    brushselected: (e: any, chart: any) => {
      const batch = e.batch?.[0];
      if (!batch) return;
      const opt = chart.getOption();
      const idx: number[] = [];
      batch.selected.forEach((s: any) => {
        const series = opt.series[s.seriesIndex];
        for (const di of s.dataIndex) {
          const pt = series.data[di];
          if (pt) idx.push(pt[pt.length - 1]);
        }
      });
      setSelected(idx);
    },
    click: (p: any) => { if (p?.value) setClicked(p.value[p.value.length - 1]); },
  }), []);

  const selRows = useMemo(() => {
    if (!data) return [];
    return selected.slice(0, 2000).map((i) => ({
      name: data.cols.name[i], artist: data.cols.artist[i], genre: data.cols.genre[i], cluster: data.cols.cluster[i],
      popularity: data.cols.popularity[i], danceability: data.cols.danceability[i], energy: data.cols.energy[i], valence: data.cols.valence[i], acousticness: data.cols.acousticness[i], id: data.cols.id[i],
    }));
  }, [selected, data]);

  const selSummary = useMemo(() => {
    if (!data || !selected.length) return null;
    const g = new Map<string, number>();
    for (const i of selected) g.set(String(data.cols.genre[i]), (g.get(String(data.cols.genre[i])) ?? 0) + 1);
    return [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [selected, data]);

  const comparison = get<Record<string, Record<string, number>>>(sum, 'dimred.comparison');
  const goTwin = useCallback((id: string) => nav(`/twins?id=${encodeURIComponent(id)}`), [nav]);

  if (status === 'missing') return <><PageHeader kicker="Acoustic Map" title="The shape of sound" /><Card><DataMissing file="embeddings.parquet" /></Card></>;

  return (
    <div>
      <PageHeader kicker="Acoustic Map" title="The shape of sound">
        A stratified sample of {data ? data.n.toLocaleString('en-US') : '10,000'} genre-labelled tracks (up to {get(sum, 'dimred.per_genre', 90)} per genre) embedded in two dimensions with four methods.
        Hover for details, drag a box or lasso to select, click a point to find its sonic twins.
      </PageHeader>
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4 border-b border-border px-5 py-4">
          <Segmented<Method> label="Embedding" value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m.value, label: m.label }))} />
          <Select className="w-64" label="Colour by" value={colorBy} onChange={setColorBy} options={COLOR_OPTS} />
          {colorBy === 'genre' && <div className="w-72"><MultiSelect label="Highlighted genres" options={genres} value={focus} onChange={setFocus} max={8} /></div>}
        </div>
        {colorBy === 'decade' && <p className="px-5 pt-3 text-xs text-subtle">The embedding sample comes from the genre table, which has no release year for most tracks, so decade colouring is not available; showing clusters instead.</p>}
        <div className="p-3">
          {q.status === 'error' ? <EmptyState title="Could not load embeddings" icon="error">{q.error}</EmptyState> :
            !option ? <Skeleton className="h-[560px]" label="Loading embedding" /> :
              <Chart option={option} height={560} onEvents={onEvents} ariaLabel={`${method.toUpperCase()} embedding scatter plot of ${data?.n} tracks, coloured by ${colorBy}`} />}
        </div>
        {clicked !== null && data && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm" aria-live="polite">
            <span><b>{String(data.cols.name[clicked])}</b> - {String(data.cols.artist[clicked])} <span className="text-subtle">({String(data.cols.genre[clicked])})</span></span>
            <button type="button" className="btn-primary btn-sm" onClick={() => goTwin(String(data.cols.id[clicked]))}><Users className="h-3.5 w-3.5" aria-hidden /> Find similar</button>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title={`Selection (${selected.length.toLocaleString('en-US')} tracks)`} subtitle={selSummary ? 'Top genres: ' + selSummary.map(([g, n]) => `${g} (${n})`).join(', ') : 'Use the box or lasso tool in the chart toolbar'} />
          <div className="p-4">
            {selRows.length ? (
              <DataTable columns={['name', 'artist', 'genre', 'cluster', 'popularity', 'danceability', 'energy', 'valence', 'acousticness']} rows={selRows} pageSize={10}
                caption="Selected tracks" onRowClick={(r) => goTwin(String(r.id))} rowLabel={(r) => `Find tracks similar to ${r.name}`} />
            ) : <EmptyState title="Nothing selected yet">Pick the box or lasso tool at the top right of the map and drag over points.</EmptyState>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Method comparison" subtitle="From the analysis notebook (summary.json)" />
          {comparison ? (
            <div className="overflow-x-auto p-4">
              <table className="w-full text-sm">
                <caption className="sr-only">Dimensionality-reduction method comparison</caption>
                <thead><tr className="text-left text-xs text-subtle"><th scope="col" className="py-1.5">Method</th><th scope="col" className="text-right">Trust. (k=10)</th><th scope="col" className="text-right">Silhouette</th><th scope="col" className="text-right">Runtime (s)</th></tr></thead>
                <tbody>
                  {Object.entries(comparison).map(([m, v]) => (
                    <tr key={m} className="border-t border-border">
                      <th scope="row" className="py-1.5 text-left font-medium">{m}</th>
                      <td className="text-right font-mono text-xs">{fmtNum(v.trustworthiness_k10)}</td>
                      <td className="text-right font-mono text-xs">{fmtNum(v.silhouette_focus_genres)}</td>
                      <td className="text-right font-mono text-xs">{fmtNum(v.runtime_s, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-subtle">Trustworthiness measures how well local neighbourhoods are preserved; silhouette is computed on the eight focus genres.</p>
            </div>
          ) : <EmptyState title="Comparison not available yet" icon="data" />}
        </Card>
      </div>
    </div>
  );
}

