import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card, CardHeader, PageHeader, Segmented, Select, Skeleton, EmptyState, Notice, MultiSelect, fmtInt, fmtNum } from '../components/ui';
import { Chart, useChartColors } from '../components/Chart';
import { useUrlState } from '../lib/urlState';
import { ensureTable, queryColumns, query, useDbState } from '../lib/db';
import { AUDIO_FEATURES, PROFILE_FEATURES, FEATURE_LABEL, fmtFeature } from '../lib/features';
import { describe as describeStats, boxStats, kde, finite } from '../lib/stats';
import { welchTTest, oneWayAnova, mannWhitneyU, formatP, effectLabelD, effectLabelEta } from '../lib/pvalues';
import { useGenreList } from '../lib/domains';
import { useSummary, clusterNames, clusterLabel } from '../lib/data';
import { quoteString } from '../lib/sqlBuilder';
import { DASHES, SYMBOLS } from '../lib/palette';

type By = 'genre' | 'decade' | 'cluster' | 'custom';
const DEFAULTS: Record<By, string[]> = {
  genre: ['classical', 'hip-hop'],
  decade: ['1970', '2010'],
  cluster: ['0', '1'],
  custom: ['explicit', 'NOT explicit'],
};

function groupWhere(by: By, v: string): string {
  if (by === 'genre') return `genre = ${quoteString(v)}`;
  if (by === 'decade') return `decade = ${Number(v)}`;
  if (by === 'cluster') return `cluster = ${Number(v)}`;
  return `(${v})`;
}

interface GroupData { label: string; cols: Record<string, number[]>; n: number }

export default function Compare() {
  const db = useDbState();
  const c = useChartColors();
  const [by, setBy] = useUrlState<By>('by', 'genre');
  const [groupsParam, setGroups] = useUrlState<string[] | null>('g', null);
  const [feature, setFeature] = useUrlState<string>('f', 'energy');
  const groups = groupsParam ?? DEFAULTS[by];
  const genres = useGenreList();
  const summary = useSummary();
  const names = clusterNames(summary.status === 'ready' ? summary.data : null);
  const [decades, setDecades] = useState<string[]>([]);
  const [data, setData] = useState<GroupData[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customDraft, setCustomDraft] = useState<string[]>(groups);
  useEffect(() => { if (by === 'custom') setCustomDraft(groups); /* eslint-disable-next-line */ }, [by, groupsParam]);

  useEffect(() => {
    if (db.phase !== 'ready') return;
    query('SELECT DISTINCT decade FROM tracks ORDER BY decade').then((r) => setDecades(r.rows.map((x) => String(x.decade))));
  }, [db.phase, db.source]);

  const table = by === 'genre' ? 'genre_tracks' : 'tracks';
  const key = JSON.stringify([by, groups]);

  useEffect(() => {
    if (db.phase !== 'ready' || groups.length < 2) { setData(null); return; }
    let alive = true;
    setLoading(true); setErr(null);
    (async () => {
      if (by === 'genre' && !(await ensureTable('genre_tracks'))) throw new Error('genre_tracks.parquet is not available yet');
      const out: GroupData[] = [];
      for (const g of groups) {
        const r = await queryColumns(`SELECT ${AUDIO_FEATURES.join(', ')} FROM ${table} WHERE ${groupWhere(by, g)}`);
        const label = by === 'cluster' ? clusterLabel(names, Number(g)) : by === 'decade' ? `${g}s` : g;
        out.push({ label, cols: r.cols as Record<string, number[]>, n: r.n });
      }
      if (alive) setData(out);
    })().catch((e) => { if (alive) { setErr(String(e?.message ?? e)); setData(null); } }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, db.phase, db.source, table]);

  const valid = data && data.every((g) => g.n >= 2);
  const values = useMemo(() => (valid ? data!.map((g) => finite(g.cols[feature] ?? [])) : null), [data, valid, feature]);
  const stats = useMemo(() => values?.map((v) => describeStats(v)), [values]);

  const test = useMemo(() => {
    if (!values || values.length < 2) return null;
    if (values.length === 2) {
      const w = welchTTest(values[0], values[1]);
      const u = mannWhitneyU(values[0], values[1]);
      return { kind: 'two' as const, w, u };
    }
    const a = oneWayAnova(values);
    const pairs: { a: number; b: number; u: ReturnType<typeof mannWhitneyU> }[] = [];
    for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) pairs.push({ a: i, b: j, u: mannWhitneyU(values[i], values[j]) });
    return { kind: 'many' as const, a, pairs };
  }, [values]);

  const sentence = useMemo(() => {
    if (!test || !data || !stats) return '';
    const f = FEATURE_LABEL[feature]?.toLowerCase() ?? feature;
    if (test.kind === 'two') {
      const hi = test.w.meanA > test.w.meanB ? 0 : 1;
      const sig = test.w.p < 0.05;
      return `${data[hi].label} has a ${sig ? 'significantly ' : ''}higher mean ${f} than ${data[1 - hi].label} (${fmtFeature(feature, stats[hi].mean)} vs ${fmtFeature(feature, stats[1 - hi].mean)}; Welch t = ${test.w.t.toFixed(2)}, df = ${test.w.df.toFixed(1)}, p ${test.w.p < 0.001 ? '< 0.001' : '= ' + test.w.p.toFixed(3)}). `
        + `The effect is ${effectLabelD(test.w.d)} (Cohen's d = ${test.w.d.toFixed(2)})${sig ? '' : ', and the difference is not significant at alpha = 0.05'}. `
        + `The rank-based Mann-Whitney U test ${test.u.p < 0.05 ? 'agrees' : 'finds no significant difference'} (p ${test.u.p < 0.001 ? '< 0.001' : '= ' + test.u.p.toFixed(3)}).`;
    }
    const sig = test.a.p < 0.05;
    const order = stats.map((s, i) => ({ i, m: s.mean })).sort((x, y) => y.m - x.m);
    return `Mean ${f} ${sig ? 'differs significantly' : 'does not differ significantly'} across the ${data.length} groups (F(${test.a.df1}, ${test.a.df2}) = ${test.a.F.toFixed(2)}, p ${test.a.p < 0.001 ? '< 0.001' : '= ' + test.a.p.toFixed(3)}). `
      + `Group membership explains ${(test.a.eta2 * 100).toFixed(1)}% of the variance (eta squared = ${test.a.eta2.toFixed(3)}, a ${effectLabelEta(test.a.eta2)} effect). Highest: ${data[order[0].i].label}; lowest: ${data[order[order.length - 1].i].label}.`;
  }, [test, data, stats, feature]);

  const radar = useMemo(() => {
    if (!valid) return null;
    const lo: Record<string, number> = {}, hi: Record<string, number> = {};
    for (const f of PROFILE_FEATURES) {
      lo[f] = Infinity; hi[f] = -Infinity;
      for (const g of data!) for (const v of g.cols[f]) { if (v < lo[f]) lo[f] = v; if (v > hi[f]) hi[f] = v; }
    }
    return {
      legend: { bottom: 0 },
      tooltip: { trigger: 'item' },
      radar: { indicator: PROFILE_FEATURES.map((f) => ({ name: FEATURE_LABEL[f].replace(/ \(.*\)/, ''), min: 0, max: 1 })), radius: '62%', axisName: { color: c.subtle }, splitLine: { lineStyle: { color: c.grid } }, splitArea: { show: false }, axisLine: { lineStyle: { color: c.grid } } },
      series: [{
        type: 'radar',
        data: data!.map((g, i) => ({
          name: g.label,
          value: PROFILE_FEATURES.map((f) => { const m = describeStats(g.cols[f]).mean; return Number(((m - lo[f]) / (hi[f] - lo[f] || 1)).toFixed(3)); }),
          lineStyle: { color: c.palette[i], width: 2, type: DASHES[i] as any }, itemStyle: { color: c.palette[i] }, symbol: SYMBOLS[i], areaStyle: { opacity: 0.08 },
        })),
      }],
    };
  }, [valid, data, c]);

  const box = useMemo(() => {
    if (!values || !data) return null;
    return {
      grid: { left: 60, right: 20, top: 20, bottom: 40 },
      tooltip: { trigger: 'item', formatter: (p: any) => p.seriesType === 'boxplot' ? `${p.name}<br/>max whisker ${fmtFeature(feature, p.value[5])}<br/>Q3 ${fmtFeature(feature, p.value[4])}<br/>median ${fmtFeature(feature, p.value[3])}<br/>Q1 ${fmtFeature(feature, p.value[2])}<br/>min whisker ${fmtFeature(feature, p.value[1])}` : '' },
      xAxis: { type: 'category', data: data.map((g) => g.label) },
      yAxis: { type: 'value', name: FEATURE_LABEL[feature], nameLocation: 'middle', nameGap: 45, scale: true },
      series: [{ type: 'boxplot', data: values.map((v, i) => ({ value: boxStats(v), itemStyle: { color: c.palette[i] + '33', borderColor: c.palette[i], borderWidth: 2 } })) }],
    };
  }, [values, data, feature, c]);

  const density = useMemo(() => {
    if (!values || !data) return null;
    return {
      grid: { left: 50, right: 20, top: 20, bottom: 60 },
      legend: { bottom: 0 },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => v?.toFixed(3) },
      xAxis: { type: 'value', name: FEATURE_LABEL[feature], nameLocation: 'middle', nameGap: 28, scale: true },
      yAxis: { type: 'value', name: 'density', nameLocation: 'middle', nameGap: 36 },
      series: values.map((v, i) => {
        const k = kde(v, 80);
        return { name: data[i].label, type: 'line', showSymbol: false, smooth: true, data: k.x.map((x, j) => [x, k.y[j]]), lineStyle: { color: c.palette[i], width: 2, type: DASHES[i] as any }, itemStyle: { color: c.palette[i] }, areaStyle: { opacity: 0.12, color: c.palette[i] } };
      }),
    };
  }, [values, data, feature, c]);

  const glance = useMemo(() => {
    if (!valid) return null;
    return AUDIO_FEATURES.map((f) => {
      const vs = data!.map((g) => finite(g.cols[f]));
      const means = vs.map((v) => describeStats(v).mean);
      if (vs.length === 2) { const w = welchTTest(vs[0], vs[1]); return { f, means, stat: `t = ${w.t.toFixed(2)}`, p: w.p, eff: `d = ${w.d.toFixed(2)}`, effAbs: Math.abs(w.d) }; }
      const a = oneWayAnova(vs); return { f, means, stat: `F = ${a.F.toFixed(1)}`, p: a.p, eff: `eta2 = ${a.eta2.toFixed(3)}`, effAbs: a.eta2 };
    }).sort((x, y) => y.effAbs - x.effAbs);
  }, [valid, data]);

  const options: string[] = by === 'genre' ? (genres ?? []) : by === 'decade' ? decades : by === 'cluster' ? ['0', '1', '2', '3', '4', '5'] : [];

  return (
    <div>
      <PageHeader kicker="Compare" title="Are these groups really different?">
        Pick two or three groups. SonicAtlas computes Tukey quartiles, G1 / G2 and live hypothesis tests in your browser
        (Welch t or one-way ANOVA, plus Mann-Whitney U) with effect sizes.
      </PageHeader>

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4 px-5 py-4">
          <Segmented<By> label="Group by" value={by} onChange={(b) => { setBy(b); setGroups(null); }} options={[{ value: 'genre', label: 'Genre' }, { value: 'decade', label: 'Decade' }, { value: 'cluster', label: 'Cluster' }, { value: 'custom', label: 'Custom SQL' }]} />
          {by !== 'custom' && (
            <div className="w-80">
              <MultiSelect label="Groups (2-3)" options={by === 'cluster' ? options.map((o) => clusterLabel(names, Number(o))) : options}
                value={by === 'cluster' ? groups.map((g) => clusterLabel(names, Number(g))) : groups}
                onChange={(v) => setGroups(by === 'cluster' ? v.map((x) => x.split(':')[0].replace('Cluster ', '').trim()) : v)} max={3} />
            </div>
          )}
          <Select className="w-56" label="Feature to test" value={feature} onChange={setFeature} options={AUDIO_FEATURES.map((f) => ({ value: f, label: FEATURE_LABEL[f] }))} />
        </div>
        {by === 'custom' && (
          <form className="space-y-2 border-t border-border px-5 py-4" onSubmit={(e) => { e.preventDefault(); setGroups(customDraft.filter((x) => x.trim())); }}>
            <p className="text-xs text-subtle">Each group is a SQL WHERE condition on the <code>tracks</code> table, e.g. <code className="kbd">year &lt; 1980 AND acousticness &gt; 0.5</code>.</p>
            {customDraft.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <label htmlFor={`cw-${i}`} className="w-20 shrink-0 text-xs font-medium text-subtle">Group {i + 1}</label>
                <input id={`cw-${i}`} className="input font-mono text-xs" value={w} onChange={(e) => setCustomDraft(customDraft.map((x, j) => (j === i ? e.target.value : x)))} />
                {customDraft.length > 2 && <button type="button" className="btn-ghost btn-sm" aria-label={`Remove group ${i + 1}`} onClick={() => setCustomDraft(customDraft.filter((_, j) => j !== i))}><X className="h-4 w-4" aria-hidden /></button>}
              </div>
            ))}
            <div className="flex gap-2">
              {customDraft.length < 3 && <button type="button" className="btn-secondary btn-sm" onClick={() => setCustomDraft([...customDraft, 'energy > 0.8'])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add group</button>}
              <button type="submit" className="btn-primary btn-sm">Apply</button>
            </div>
          </form>
        )}
      </Card>

      {err && <div className="mb-4"><Notice tone="error">{err}</Notice></div>}
      {groups.length < 2 ? <Card><EmptyState title="Pick at least two groups" /></Card> : !valid ? (
        loading || !data ? <div className="space-y-6"><Card><CardHeader title="Hypothesis test" subtitle={`${FEATURE_LABEL[feature]} - computed live in TypeScript`} /><div className="min-h-[245px] space-y-4 p-5"><p className="text-base leading-relaxed">Loading the Parquet data into your browser and computing the test for the selected groups. This runs locally and takes a few seconds on the first visit.</p></div></Card><div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-[453px]" /><Skeleton className="h-[453px]" /></div><Skeleton className="h-[392px]" /><Skeleton className="h-[194px]" /><Skeleton className="h-[458px]" /></div>
          : <Card><EmptyState title="A group has fewer than two tracks">Choose different groups or loosen the condition.</EmptyState></Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Hypothesis test" subtitle={`${FEATURE_LABEL[feature]} - computed live in TypeScript`} />
            <div className="space-y-4 p-5" data-testid="test-result">
              <p className="text-base leading-relaxed">{sentence}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {test?.kind === 'two' ? (
                  <>
                    <Metric label="Welch t" value={test.w.t.toFixed(3)} sub={`df = ${test.w.df.toFixed(1)}`} />
                    <Metric label="p-value (Welch)" value={formatP(test.w.p)} testid="p-value" />
                    <Metric label="Cohen's d" value={test.w.d.toFixed(3)} sub={effectLabelD(test.w.d)} />
                    <Metric label="Mann-Whitney U" value={fmtInt(test.u.U)} sub={`z = ${test.u.z.toFixed(2)}, p = ${formatP(test.u.p)}, r = ${test.u.r.toFixed(3)}`} />
                  </>
                ) : test?.kind === 'many' ? (
                  <>
                    <Metric label="ANOVA F" value={test.a.F.toFixed(3)} sub={`df = (${test.a.df1}, ${test.a.df2})`} />
                    <Metric label="p-value (ANOVA)" value={formatP(test.a.p)} testid="p-value" />
                    <Metric label="Eta squared" value={test.a.eta2.toFixed(4)} sub={effectLabelEta(test.a.eta2)} />
                    <Metric label="Mann-Whitney U (pairs)" value={`${test.pairs.filter((p) => p.u.p < 0.05).length} / ${test.pairs.length}`} sub={test.pairs.map((p) => `${data![p.a].label} vs ${data![p.b].label}: p = ${formatP(p.u.p)}`).join('; ')} />
                  </>
                ) : null}
              </div>
              <p className="text-xs text-subtle">With thousands of tracks per group even tiny differences become "significant"; read the effect size first. Mann-Whitney uses the tie-corrected normal approximation with continuity correction.</p>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader title="Audio profile (means)" subtitle="Scaled to the min / max of the pooled groups" />
              <div className="p-3">{radar && <Chart option={radar} height={360} ariaLabel="Radar chart of mean audio features per group" />}</div></Card>
            <Card><CardHeader title={`${FEATURE_LABEL[feature]} distribution`} subtitle="Boxplot with Tukey hinges and 1.5 IQR whiskers" />
              <div className="p-3">{box && <Chart option={box} height={360} ariaLabel={`Boxplot of ${feature} per group`} />}</div></Card>
          </div>
          <Card><CardHeader title="Density (violin-like view)" subtitle="Gaussian KDE, Silverman bandwidth" />
            <div className="p-3">{density && <Chart option={density} height={300} ariaLabel={`Kernel density of ${feature} per group`} />}</div></Card>

          <Card>
            <CardHeader title="Descriptive statistics" subtitle="Sample variance uses n-1; Q1 / Q3 are Tukey hinges (median of halves, odd n includes the median); G1 adjusted Fisher-Pearson skewness; G2 bias-corrected excess kurtosis" />
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-max text-sm" data-testid="stats-table">
                <caption className="sr-only">Descriptive statistics of {feature} by group</caption>
                <thead><tr className="text-left text-xs text-subtle">{['Group', 'n', 'Mean', 'Median', 'Std', 'Q1', 'Q3', 'IQR', 'Min', 'Max', 'G1', 'G2'].map((h) => <th key={h} scope="col" className="px-2 py-1.5 text-right first:text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {stats!.map((s, i) => (
                    <tr key={i} className="border-t border-border">
                      <th scope="row" className="px-2 py-1.5 text-left font-medium"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c.palette[i] }} aria-hidden />{data![i].label}</th>
                      {[fmtInt(s.n), s.mean, s.median, s.std, s.q1, s.q3, s.iqr, s.min, s.max, s.g1, s.g2].map((v, j) => <td key={j} className="px-2 text-right font-mono text-xs">{typeof v === 'string' ? v : fmtNum(v, 4)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {glance && (
            <Card>
              <CardHeader title="All features at a glance" subtitle="Ranked by effect size; click a feature to test it" />
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-max text-sm">
                  <caption className="sr-only">Group means and tests for every feature</caption>
                  <thead><tr className="text-left text-xs text-subtle"><th scope="col" className="px-2 py-1.5">Feature</th>{data!.map((g) => <th key={g.label} scope="col" className="px-2 text-right">{g.label}</th>)}<th scope="col" className="px-2 text-right">Statistic</th><th scope="col" className="px-2 text-right">p</th><th scope="col" className="px-2 text-right">Effect</th></tr></thead>
                  <tbody>
                    {glance.map((r) => (
                      <tr key={r.f} className={`border-t border-border ${r.f === feature ? 'bg-accent/5' : ''}`}>
                        <th scope="row" className="px-2 py-1.5 text-left font-medium"><button type="button" className="hover:text-accent hover:underline" onClick={() => setFeature(r.f)}>{FEATURE_LABEL[r.f]}</button></th>
                        {r.means.map((m, i) => <td key={i} className="px-2 text-right font-mono text-xs">{fmtFeature(r.f, m)}</td>)}
                        <td className="px-2 text-right font-mono text-xs">{r.stat}</td><td className="px-2 text-right font-mono text-xs">{formatP(r.p)}</td><td className="px-2 text-right font-mono text-xs">{r.eff}</td>
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

function Metric({ label, value, sub, testid }: { label: string; value: string; sub?: string; testid?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold" data-testid={testid}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-subtle">{sub}</div>}
    </div>
  );
}
