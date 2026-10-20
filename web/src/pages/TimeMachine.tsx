import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, SkipBack } from 'lucide-react';
import { Card, CardHeader, PageHeader, MultiSelect, Select, Skeleton, DataMissing, fmtInt } from '../components/ui';
import { Chart, useChartColors } from '../components/Chart';
import { useJSON, useSummary, get } from '../lib/data';
import { useUrlState } from '../lib/urlState';
import { FEATURE_LABEL, fmtFeature, PROFILE_FEATURES } from '../lib/features';
import { DASHES, SYMBOLS } from '../lib/palette';

interface TS {
  years: number[];
  yearly: Record<string, number[]>;
  n_tracks: number[];
  months: string[];
  stl: Record<string, { observed: number[]; trend: number[]; seasonal: number[] }>;
  change_points: Record<string, number[]>;
  decade_means: Record<string, Record<string, number>>;
}

const label = (f: string) => FEATURE_LABEL[f] ?? f;

export default function TimeMachine() {
  const ts = useJSON<TS>('timeseries.json');
  const summary = useSummary();
  const sum = summary.status === 'ready' ? summary.data : null;
  const c = useChartColors();
  const [features, setFeatures] = useUrlState<string[]>('f', ['loudness', 'energy', 'acousticness', 'danceability']);
  const [stlFeat, setStlFeat] = useUrlState<string>('stl', 'energy');
  const [decIdx, setDecIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  const d = ts.status === 'ready' ? ts.data : null;
  const allFeats = d ? Object.keys(d.yearly) : [];
  const decades = d ? Object.keys(d.decade_means).sort() : [];

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setDecIdx((i) => {
        if (i >= decades.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 1100);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, decades.length]);

  const trendCharts = useMemo(() => {
    if (!d) return [];
    return features.filter((f) => d.yearly[f]).map((f, i) => {
      const cps = d.change_points?.[f] ?? [];
      return {
        f,
        option: {
          grid: { left: 52, right: 16, top: 48, bottom: 30 },
          title: { text: label(f), left: 8, top: 0, textStyle: { fontSize: 13, color: c.text, fontWeight: 600 } },
          tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmtFeature(f, v) },
          xAxis: { type: 'category', data: d.years, boundaryGap: false, axisLabel: { interval: 9 } },
          yAxis: { type: 'value', scale: true },
          series: [{
            name: label(f), type: 'line', data: d.yearly[f], showSymbol: false, lineStyle: { width: 2, color: c.palette[i % 8], type: DASHES[i % DASHES.length] as any }, itemStyle: { color: c.palette[i % 8] },
            markLine: cps.length ? { symbol: 'none', label: { formatter: (p: any) => `change ${p.value}`, color: c.subtle, fontSize: 10 }, lineStyle: { color: c.subtle, type: 'dashed' }, data: cps.map((y) => ({ xAxis: String(y) })) } : undefined,
          }],
        },
        cps,
      };
    });
  }, [d, features, c]);

  const stlOption = useMemo(() => {
    if (!d || !d.stl?.[stlFeat]) return null;
    const s = d.stl[stlFeat];
    const parts: [string, number[]][] = [['Observed', s.observed], ['Trend', s.trend], ['Seasonal', s.seasonal]];
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => v?.toFixed(4) },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: parts.map((_, i) => ({ left: 60, right: 16, top: `${4 + i * 32}%`, height: '24%' })),
      xAxis: parts.map((_, i) => ({ type: 'category', data: d.months, gridIndex: i, boundaryGap: false, axisLabel: { show: i === 2, interval: 23 }, axisTick: { show: i === 2 } })),
      yAxis: parts.map(([n], i) => ({ type: 'value', scale: true, gridIndex: i, name: n, nameLocation: 'middle', nameGap: 46, splitNumber: 3 })),
      dataZoom: [{ type: 'inside', xAxisIndex: [0, 1, 2] }],
      series: parts.map(([n, v], i) => ({ name: n, type: 'line', xAxisIndex: i, yAxisIndex: i, data: v, showSymbol: false, lineStyle: { width: i === 1 ? 2.5 : 1.2, color: c.palette[i] }, itemStyle: { color: c.palette[i] } })),
    };
  }, [d, stlFeat, c]);

  const decadeRadar = useMemo(() => {
    if (!d || !decades.length) return null;
    const feats = PROFILE_FEATURES.filter((f) => d.decade_means[decades[0]]?.[f] !== undefined);
    const lo: Record<string, number> = {}, hi: Record<string, number> = {};
    for (const f of feats) { const vs = decades.map((k) => d.decade_means[k][f]); lo[f] = Math.min(...vs); hi[f] = Math.max(...vs); }
    const sc = (k: string) => feats.map((f) => Number(((d.decade_means[k][f] - lo[f]) / (hi[f] - lo[f] || 1)).toFixed(3)));
    const cur = decades[Math.min(decIdx, decades.length - 1)];
    return {
      legend: { bottom: 0, data: [`${decades[0]}s`, `${cur}s`] },
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          const k = p.name.replace('s', '');
          return `<b>${p.name}</b><br/>` + feats.map((f) => `${label(f)}: ${fmtFeature(f, d.decade_means[k]?.[f])}`).join('<br/>');
        },
      },
      radar: { indicator: feats.map((f) => ({ name: label(f).replace(/ \(.*\)/, ''), min: 0, max: 1 })), radius: '62%', axisName: { color: c.subtle }, splitLine: { lineStyle: { color: c.grid } }, splitArea: { show: false }, axisLine: { lineStyle: { color: c.grid } } },
      series: [{
        type: 'radar',
        animationDurationUpdate: 900,
        data: [
          { name: `${decades[0]}s`, value: sc(decades[0]), lineStyle: { color: c.subtle, type: 'dashed', width: 1.5 }, itemStyle: { color: c.subtle }, symbol: 'rect' },
          { name: `${cur}s`, value: sc(cur), lineStyle: { color: c.palette[1], width: 3 }, itemStyle: { color: c.palette[1] }, areaStyle: { opacity: 0.2, color: c.palette[1] } },
        ],
      }],
    };
  }, [d, decades, decIdx, c]);

  const decadeBars = useMemo(() => {
    if (!d || !decades.length) return null;
    return {
      grid: { left: 52, right: 16, top: 20, bottom: 50 },
      legend: { bottom: 0 },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => v?.toFixed(3) },
      xAxis: { type: 'category', data: decades.map((k) => `${k}s`) },
      yAxis: { type: 'value', name: 'mean (0-1 features)', nameLocation: 'middle', nameGap: 38 },
      series: features.filter((f) => !['loudness', 'tempo', 'duration_min'].includes(f) && d.decade_means[decades[0]]?.[f] !== undefined).map((f, i) => ({
        name: label(f), type: 'line', data: decades.map((k) => d.decade_means[k][f]), symbol: SYMBOLS[i % 8], symbolSize: 8, lineStyle: { color: c.palette[i % 8], type: DASHES[i % DASHES.length] as any }, itemStyle: { color: c.palette[i % 8] },
      })),
    };
  }, [d, decades, features, c]);

  if (ts.status === 'missing') return <><PageHeader kicker="Time Machine" title="How music changed" /><Card><DataMissing file="timeseries.json" /></Card></>;

  const cur = decades[Math.min(decIdx, decades.length - 1)];
  return (
    <div>
      <PageHeader kicker="Time Machine" title="How music changed">
        Yearly means of canonical releases{get(sum, 'timeseries.year_window') ? ` between ${get<number[]>(sum, 'timeseries.year_window')[0]} and ${get<number[]>(sum, 'timeseries.year_window')[1]}` : ''}
        {get(sum, 'timeseries.tracks_in_window') ? ` (${fmtInt(get(sum, 'timeseries.tracks_in_window'))} tracks)` : ''}, with change points detected in the analysis notebook, an STL decomposition of the monthly series, and decade means.
      </PageHeader>
      {!d ? <div className="space-y-4"><Skeleton className="h-16" /><div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div></div> : (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-end gap-4 px-5 py-4">
              <div className="w-full max-w-xl"><MultiSelect label="Features" options={allFeats} value={features} onChange={setFeatures} max={8} /></div>
            </div>
          </Card>
          <section aria-labelledby="trend-h">
            <h2 id="trend-h" className="h2 mb-3">Yearly trends</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {trendCharts.map((t) => (
                <Card key={t.f} className="p-3">
                  <Chart option={t.option} height={240} ariaLabel={`Yearly mean ${t.f}${t.cps.length ? `, change points at ${t.cps.join(', ')}` : ''}`} />
                  {t.cps.length > 0 && <p className="px-2 pb-1 text-xs text-subtle">Change points (dashed): {t.cps.join(', ')}</p>}
                </Card>
              ))}
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Decade means, animated" subtitle={`Each axis scaled to the min / max across decades; dashed = ${decades[0]}s baseline`}
                actions={
                  <>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => { setPlaying(false); setDecIdx(0); }} aria-label="Rewind to first decade"><SkipBack className="h-3.5 w-3.5" aria-hidden /></button>
                    <button type="button" className="btn-primary btn-sm" data-testid="play-decades" onClick={() => { if (decIdx >= decades.length - 1) setDecIdx(0); setPlaying((p) => !p); }} aria-pressed={playing}>
                      {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />} {playing ? 'Pause' : 'Play'}
                    </button>
                  </>
                } />
              <div className="px-5 pt-3">
                <label htmlFor="dec-slider" className="label">Decade: <span className="text-2xl font-semibold normal-case tracking-normal text-fg" aria-live="polite">{cur}s</span></label>
                <input id="dec-slider" type="range" className="single" min={0} max={Math.max(0, decades.length - 1)} value={decIdx} onChange={(e) => { setPlaying(false); setDecIdx(Number(e.target.value)); }} aria-valuetext={`${cur}s`} />
              </div>
              <div className="p-3">{decadeRadar && <Chart option={decadeRadar} height={360} notMerge={false} ariaLabel={`Radar of decade mean features for the ${cur}s compared with the ${decades[0]}s`} />}</div>
            </Card>
            <Card>
              <CardHeader title="Decade means (0-1 features)" subtitle="Selected unit-scale features" />
              <div className="p-3">{decadeBars && <Chart option={decadeBars} height={420} ariaLabel="Line chart of decade means for selected features" />}</div>
            </Card>
          </div>

          <Card>
            <CardHeader title="STL decomposition (monthly)" subtitle={`${d.months[0]} to ${d.months[d.months.length - 1]}; day-precision releases, 1 January dates excluded; period 12, robust`}
              actions={<Select label="Feature" value={stlFeat} onChange={setStlFeat} options={Object.keys(d.stl ?? {}).map((f) => ({ value: f, label: label(f) }))} />} />
            <div className="p-3">{stlOption ? <Chart option={stlOption} height={520} ariaLabel={`STL decomposition of monthly mean ${stlFeat} into observed, trend and seasonal components`} /> : <Skeleton className="h-96" />}</div>
          </Card>

          <Card>
            <CardHeader title="Tracks per year" subtitle="The catalogue is heavily skewed toward recent years" />
            <div className="p-3">
              <Chart height={220} ariaLabel="Bar chart of number of tracks per year" option={{
                grid: { left: 60, right: 16, top: 16, bottom: 30 },
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: d.years, axisLabel: { interval: 9 } },
                yAxis: { type: 'value' },
                series: [{ type: 'bar', data: d.n_tracks, itemStyle: { color: c.palette[0] }, name: 'tracks' }],
              }} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
