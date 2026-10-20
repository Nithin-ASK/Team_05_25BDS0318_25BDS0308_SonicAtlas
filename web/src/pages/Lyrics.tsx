import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardHeader, PageHeader, Segmented, Skeleton, DataMissing, Stat, EmptyState, fmtInt, fmtNum } from '../components/ui';
import { Chart, useChartColors } from '../components/Chart';
import { useJSON, useSummary, get } from '../lib/data';
import { useUrlState } from '../lib/urlState';
import { SYMBOLS, DASHES } from '../lib/palette';

interface LyricsWeb {
  vocab: string[];
  tag_counts: Record<string, number[]>;
  decade_counts: Record<string, number[]>;
  tag_docs: Record<string, number>;
  decade_docs: Record<string, number>;
  ngrams: Record<string, [string, number][]>;
  by_tag: Record<string, Record<string, number>>;
  by_decade: Record<string, Record<string, number>>;
  distinguishing: Record<string, string[]>;
  scatter: { valence: number; vader: number; textblob: number; tag: string }[];
  ttr_hist: Record<string, number[]>;
  r_valence_vader?: number;
  matched_n?: number;
}

const TAG_LABEL: Record<string, string> = { rb: 'R&B', pop: 'Pop', rap: 'Rap', rock: 'Rock', country: 'Country', misc: 'Misc' };
const tl = (t: string) => TAG_LABEL[t] ?? t;

export default function Lyrics() {
  const lj = useJSON<LyricsWeb>('lyrics_web.json');
  const summary = useSummary();
  const ls = get<any>(summary.status === 'ready' ? summary.data : null, 'lyrics');
  const c = useChartColors();
  const [n, setN] = useUrlState<'1' | '2' | '3'>('n', '1');
  const [word, setWord] = useUrlState<string>('w', 'love');
  const [scoreBy, setScoreBy] = useState<'vader' | 'textblob'>('vader');
  const d = lj.status === 'ready' ? lj.data : null;
  const tags = d ? Object.keys(d.by_tag) : [];
  const tagColor = (t: string) => c.palette[tags.indexOf(t) % 8];

  const ngram = useMemo(() => {
    if (!d) return null;
    const items = [...(d.ngrams[n] ?? [])].reverse();
    return {
      grid: { left: 130, right: 30, top: 10, bottom: 30 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', name: 'count', nameLocation: 'middle', nameGap: 24 },
      yAxis: { type: 'category', data: items.map((x) => x[0]), axisLabel: { fontSize: 11 } },
      series: [{ type: 'bar', data: items.map((x) => x[1]), itemStyle: { color: c.palette[0] }, label: { show: true, position: 'right', color: c.subtle, fontSize: 10 } }],
    };
  }, [d, n, c]);

  const byTag = useMemo(() => {
    if (!d) return null;
    return {
      aria: { enabled: true, decal: { show: true } },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      legend: { top: 0 },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => v?.toFixed(3) },
      xAxis: { type: 'category', data: tags.map(tl) },
      yAxis: { type: 'value', name: 'mean sentiment', nameLocation: 'middle', nameGap: 36 },
      series: [
        { name: 'VADER (compound)', type: 'bar', data: tags.map((t) => d.by_tag[t].vader), itemStyle: { color: c.palette[0] } },
        { name: 'TextBlob (polarity)', type: 'bar', data: tags.map((t) => d.by_tag[t].textblob), itemStyle: { color: c.palette[1] } },
      ],
    };
  }, [d, tags, c]);

  const byDecade = useMemo(() => {
    if (!d) return null;
    const ks = Object.keys(d.by_decade).sort();
    return {
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      legend: { top: 0 },
      tooltip: { trigger: 'axis', formatter: (ps: any[]) => `${ps[0].name}<br/>` + ps.map((p) => `${p.seriesName}: ${p.value.toFixed(3)}`).join('<br/>') + `<br/>n = ${d.by_decade[ps[0].name.replace('s', '')]?.n}` },
      xAxis: { type: 'category', data: ks.map((k) => `${k}s`) },
      yAxis: { type: 'value', name: 'mean sentiment', nameLocation: 'middle', nameGap: 36 },
      series: [
        { name: 'VADER', type: 'line', data: ks.map((k) => d.by_decade[k].vader), symbol: 'circle', symbolSize: 8, lineStyle: { color: c.palette[3], width: 2 }, itemStyle: { color: c.palette[3] } },
        { name: 'TextBlob', type: 'line', data: ks.map((k) => d.by_decade[k].textblob), symbol: 'rect', symbolSize: 8, lineStyle: { color: c.palette[2], width: 2, type: 'dashed' }, itemStyle: { color: c.palette[2] } },
      ],
    };
  }, [d, c]);

  const scatter = useMemo(() => {
    if (!d) return null;
    return {
      grid: { left: 50, right: 20, top: 20, bottom: 70 },
      legend: { bottom: 0 },
      tooltip: { trigger: 'item', formatter: (p: any) => `${p.seriesName}<br/>valence ${p.value[0]}<br/>${scoreBy} ${p.value[1]}` },
      xAxis: { type: 'value', name: 'audio valence (Spotify)', nameLocation: 'middle', nameGap: 26, min: 0, max: 1 },
      yAxis: { type: 'value', name: scoreBy === 'vader' ? 'lyric sentiment (VADER)' : 'lyric sentiment (TextBlob)', nameLocation: 'middle', nameGap: 36 },
      series: tags.map((t, i) => ({ name: tl(t), type: 'scatter', symbol: SYMBOLS[i % 8], symbolSize: 6, data: d.scatter.filter((p) => p.tag === t).map((p) => [p.valence, p[scoreBy]]), itemStyle: { color: tagColor(t), opacity: 0.65 } })),
    };
  }, [d, tags, scoreBy, c]);

  const ttr = useMemo(() => {
    if (!d) return null;
    const bins = Array.from({ length: 30 }, (_, i) => ((i + 0.5) / 30).toFixed(3));
    return {
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      legend: { top: 0 },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${(v * 100).toFixed(1)}%` },
      xAxis: { type: 'category', data: bins, name: 'type-token ratio', nameLocation: 'middle', nameGap: 26, axisLabel: { interval: 4 } },
      yAxis: { type: 'value', name: 'share of songs', nameLocation: 'middle', nameGap: 38, axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(0)}%` } },
      series: Object.entries(d.ttr_hist).map(([t, h], i) => {
        const tot = h.reduce((a, b) => a + b, 0) || 1;
        return { name: tl(t), type: 'line', smooth: true, showSymbol: false, data: h.map((x) => x / tot), lineStyle: { color: tagColor(t), width: 2, type: DASHES[i % DASHES.length] as any }, itemStyle: { color: tagColor(t) } };
      }),
    };
  }, [d, c]);

  const wq = word.trim().toLowerCase();
  const wIdx = d ? d.vocab.indexOf(wq) : -1;
  const suggestions = d && wq && wIdx < 0 ? d.vocab.filter((v) => v.startsWith(wq.slice(0, 3))).slice(0, 10) : [];
  const wordCharts = useMemo(() => {
    if (!d || wIdx < 0) return null;
    const ks = Object.keys(d.decade_counts).sort();
    return {
      tag: {
        grid: { left: 50, right: 20, top: 20, bottom: 30 },
        tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${v.toFixed(1)} uses per 1,000 songs` },
        xAxis: { type: 'category', data: tags.map(tl), axisLabel: { interval: 0 } },
        yAxis: { type: 'value', name: 'uses per 1,000 songs', nameLocation: 'middle', nameGap: 38 },
        series: [{ type: 'bar', name: wq, data: tags.map((t) => ({ value: (1000 * (d.tag_counts[t]?.[wIdx] ?? 0)) / (d.tag_docs[t] || 1), itemStyle: { color: tagColor(t) } })) }],
      },
      decade: {
        grid: { left: 50, right: 20, top: 20, bottom: 30 },
        tooltip: { trigger: 'axis', formatter: (ps: any[]) => `${ps[0].name}: ${ps[0].value.toFixed(1)} uses per 1,000 songs (n = ${fmtInt(d.decade_docs[ps[0].name.replace('s', '')])} songs)` },
        xAxis: { type: 'category', data: ks.map((k) => `${k}s`) },
        yAxis: { type: 'value', name: 'uses per 1,000 songs', nameLocation: 'middle', nameGap: 38 },
        series: [{ type: 'line', name: wq, data: ks.map((k) => (1000 * (d.decade_counts[k]?.[wIdx] ?? 0)) / (d.decade_docs[k] || 1)), symbol: 'circle', symbolSize: 8, lineStyle: { color: c.palette[5], width: 2 }, itemStyle: { color: c.palette[5] } }],
      },
    };
  }, [d, wIdx, wq, tags, c]);

  if (lj.status === 'missing') return <><PageHeader kicker="Lyrics Lab" title="What the words say" /><Card><DataMissing file="lyrics_web.json" /></Card></>;

  return (
    <div>
      <PageHeader kicker="Lyrics Lab" title="What the words say">
        Aggregates from a sample of English Genius lyrics: n-grams, VADER and TextBlob sentiment by tag and decade, vocabulary diversity, and how lyric
        sentiment relates to Spotify's audio valence. Lyric text is not redistributed - only counts.
      </PageHeader>
      {!d ? <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Songs analysed" value={fmtInt(ls?.rows_used)} hint={ls?.n_total ? `of ${fmtInt(ls.n_total)} in the Genius dump` : undefined} />
            <Stat label="Median words / song" value={fmtInt(ls?.median_words)} hint={ls?.median_ttr !== undefined ? `median TTR ${fmtNum(ls.median_ttr, 2)}` : undefined} />
            <Stat label="VADER vs TextBlob" value={ls?.vader_textblob_r !== undefined ? `r = ${fmtNum(ls.vader_textblob_r, 2)}` : '-'} hint={ls?.sign_agreement_pct !== undefined ? `same sign for ${fmtNum(ls.sign_agreement_pct, 1)}%` : undefined} />
            <Stat label="Sentiment vs valence" value={d.r_valence_vader !== undefined ? `r = ${fmtNum(d.r_valence_vader, 2)}` : '-'} hint={`${fmtInt(d.matched_n ?? d.scatter.length)} songs matched to audio`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Most frequent n-grams" subtitle="Stop words removed" actions={<Segmented label="n-gram size" hideLabel value={n} onChange={setN} options={[{ value: '1', label: 'Words' }, { value: '2', label: 'Bigrams' }, { value: '3', label: 'Trigrams' }]} />} />
              <div className="p-3">{ngram && <Chart option={ngram} height={420} ariaLabel={`Bar chart of the top ${n}-grams`} />}</div>
            </Card>
            <Card>
              <CardHeader title="Word search" subtitle={`Word uses per 1,000 songs across tags and decades (top ${d.vocab.length.toLocaleString('en-US')} content words)`} />
              <div className="space-y-3 p-4">
                <form onSubmit={(e) => e.preventDefault()} className="relative">
                  <label htmlFor="word-q" className="sr-only">Word</label>
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-subtle" aria-hidden />
                  <input id="word-q" className="input pl-9" value={word} onChange={(e) => setWord(e.target.value)} placeholder="e.g. love, night, money" />
                </form>
                {wIdx < 0 ? (
                  <EmptyState title={wq ? `"${wq}" is not in the vocabulary` : 'Type a word'}>
                    {suggestions.length > 0 && <div className="mt-2 flex flex-wrap justify-center gap-1">{suggestions.map((s) => <button key={s} type="button" className="chip hover:bg-border" onClick={() => setWord(s)}>{s}</button>)}</div>}
                  </EmptyState>
                ) : wordCharts && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Chart option={wordCharts.tag} height={260} ariaLabel={`Frequency of ${wq} by tag`} />
                    <Chart option={wordCharts.decade} height={260} ariaLabel={`Frequency of ${wq} by decade`} />
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card><CardHeader title="Sentiment by tag" subtitle="Mean VADER compound and TextBlob polarity (bars also patterned)" />
              <div className="p-3">{byTag && <Chart option={byTag} height={320} ariaLabel="Grouped bar chart of mean lyric sentiment by genre tag" />}</div></Card>
            <Card><CardHeader title="Sentiment by decade" subtitle="Decades with at least 50 scored songs" />
              <div className="p-3">{byDecade && <Chart option={byDecade} height={320} ariaLabel="Line chart of mean lyric sentiment by decade" />}</div></Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Lyric sentiment vs audio valence" subtitle={`${fmtInt(d.scatter.length)} songs matched by title and artist`}
                actions={<Segmented label="Sentiment score" hideLabel value={scoreBy} onChange={setScoreBy} options={[{ value: 'vader', label: 'VADER' }, { value: 'textblob', label: 'TextBlob' }]} />} />
              <div className="p-3">{scatter && <Chart option={scatter} height={380} ariaLabel="Scatter plot of lyric sentiment against audio valence" />}</div>
            </Card>
            <Card>
              <CardHeader title="Vocabulary diversity" subtitle="Distribution of the type-token ratio (unique words / words) by tag" />
              <div className="p-3">{ttr && <Chart option={ttr} height={380} ariaLabel="Line chart of type-token ratio distributions by tag" />}</div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Distinguishing words and per-tag summary" subtitle="Words most over-represented in each tag relative to the others" />
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-max text-sm">
                <caption className="sr-only">Lyrics summary by tag</caption>
                <thead><tr className="text-xs text-subtle"><th scope="col" className="px-2 py-1.5 text-left">Tag</th><th scope="col" className="px-2 text-right">Songs</th><th scope="col" className="px-2 text-right">Median words</th><th scope="col" className="px-2 text-right">Median TTR</th><th scope="col" className="px-2 text-right">VADER</th><th scope="col" className="px-2 text-left">Distinguishing words</th></tr></thead>
                <tbody>
                  {tags.map((t) => (
                    <tr key={t} className="border-t border-border align-top">
                      <th scope="row" className="px-2 py-2 text-left font-medium">{tl(t)}</th>
                      <td className="px-2 py-2 text-right font-mono text-xs">{fmtInt(d.by_tag[t].songs)}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs">{fmtInt(d.by_tag[t].words)}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs">{fmtNum(d.by_tag[t].ttr, 3)}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs">{fmtNum(d.by_tag[t].vader, 3)}</td>
                      <td className="px-2 py-2"><div className="flex flex-wrap gap-1">{(d.distinguishing[t] ?? []).map((w) => <button key={w} type="button" className="chip hover:bg-border" onClick={() => setWord(w)}>{w}</button>)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
