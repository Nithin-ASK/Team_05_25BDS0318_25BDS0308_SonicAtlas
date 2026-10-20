import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardHeader, PageHeader, Skeleton, DataMissing, Stat, EmptyState, fmtInt, fmtNum } from '../components/ui';
import { Chart, useChartColors } from '../components/Chart';
import { useJSON, useSummary, get } from '../lib/data';
import { useUrlState } from '../lib/urlState';
import { SYMBOLS } from '../lib/palette';
import { escapeHtml } from '../lib/format';

interface Node { id: string; degree: number; tracks: number; betweenness: number; community: number; x: number; y: number; energy?: number; danceability?: number; acousticness?: number; valence?: number }
interface Net { nodes: Node[]; links: { source: string; target: string; weight: number }[] }
const SIG = ['energy', 'danceability', 'acousticness', 'valence'] as const;

export default function Network() {
  const net = useJSON<Net>('network.json');
  const summary = useSummary();
  const ns = get<any>(summary.status === 'ready' ? summary.data : null, 'network');
  const c = useChartColors();
  const [sel, setSel] = useUrlState<string>('a', '');
  const [q, setQ] = useState('');
  const d = net.status === 'ready' ? net.data : null;

  const comms = useMemo(() => {
    if (!d) return [];
    const cnt = new Map<number, number>();
    for (const n of d.nodes) cnt.set(n.community, (cnt.get(n.community) ?? 0) + 1);
    return [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [d]);
  const top = comms.slice(0, 8);

  const neighbours = useMemo(() => {
    if (!d || !sel) return [];
    return d.links.filter((l) => l.source === sel || l.target === sel).map((l) => ({ artist: l.source === sel ? l.target : l.source, weight: l.weight })).sort((a, b) => b.weight - a.weight);
  }, [d, sel]);
  const nb = useMemo(() => new Set(neighbours.map((x) => x.artist)), [neighbours]);

  const option = useMemo(() => {
    if (!d) return null;
    const maxDeg = Math.max(...d.nodes.map((n) => n.degree), 1);
    const catOf = (n: Node) => { const i = top.indexOf(n.community); return i < 0 ? top.length : i; };
    const categories = [...top.map((k, i) => ({ name: `Community ${k}`, symbol: SYMBOLS[i % 8], itemStyle: { color: c.palette[i % 8] } })), { name: 'Other communities', symbol: 'circle', itemStyle: { color: c.dark ? '#5b6577' : '#b8bec8' } }];
    const labelSet = new Set([...d.nodes].sort((a, b) => b.degree - a.degree).slice(0, 8).map((n) => n.id));
    // The notebook spring layout seeds an ECharts force layout (display only).
    const pos = (n: Node) => [n.x * 600, n.y * 600];
    return {
      legend: { bottom: 0, type: 'scroll', data: categories.map((x) => x.name) },
      tooltip: { trigger: 'item', formatter: (p: any) => p.dataType === 'edge' ? `${escapeHtml(p.data.source)} &harr; ${escapeHtml(p.data.target)}<br/>${p.data.value} shared track(s)` : `<b>${escapeHtml(p.data.name)}</b><br/>degree ${p.data.degree}, tracks ${p.data.tracks}<br/>community ${p.data.community}` },
      series: [{
        type: 'graph', layout: 'force', force: { repulsion: 110, gravity: 0.25, edgeLength: [30, 120], friction: 0.15, layoutAnimation: false }, roam: true, zoom: 0.7, top: 20, bottom: 70, draggable: false, categories,
        data: d.nodes.map((n) => {
          const dim = sel && n.id !== sel && !nb.has(n.id);
          return {
            id: n.id, name: n.id, x: pos(n)[0], y: pos(n)[1], value: n.degree, degree: n.degree, tracks: n.tracks, community: n.community,
            category: catOf(n), symbolSize: 5 + 20 * Math.sqrt(n.degree / maxDeg),
            itemStyle: { opacity: dim ? 0.15 : 0.9, borderColor: n.id === sel ? c.text : undefined, borderWidth: n.id === sel ? 2 : 0 },
            label: { show: labelSet.has(n.id) || n.id === sel, color: c.text, fontSize: 10, position: 'right' },
          };
        }),
        links: d.links.map((l) => ({ source: l.source, target: l.target, value: l.weight, lineStyle: { opacity: sel ? (l.source === sel || l.target === sel ? 0.8 : 0.03) : 0.18, width: Math.min(4, 0.5 + Math.log2(1 + l.weight)) } })),
        lineStyle: { color: c.subtle, curveness: 0.1 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 2 } },
        scaleLimit: { min: 0.4, max: 6 },
        labelLayout: { hideOverlap: true },
      }],
    };
  }, [d, top, sel, nb, c]);

  const node = d?.nodes.find((n) => n.id === sel) ?? null;
  const hits = d && q.trim().length > 1 ? d.nodes.filter((n) => n.id.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];

  const sig = useMemo(() => {
    if (!d || !node) return null;
    const avg = Object.fromEntries(SIG.map((f) => { const vs = d.nodes.map((n) => n[f]).filter((v): v is number => typeof v === 'number'); return [f, vs.reduce((a, b) => a + b, 0) / (vs.length || 1)]; }));
    return {
      aria: { enabled: true, decal: { show: true } },
      grid: { left: 90, right: 20, top: 30, bottom: 20 },
      legend: { top: 0 },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => v?.toFixed(3) },
      xAxis: { type: 'value', min: 0, max: 1 },
      yAxis: { type: 'category', data: SIG.map((f) => f) },
      series: [
        { name: node.id.length > 24 ? node.id.slice(0, 22) + '...' : node.id, type: 'bar', data: SIG.map((f) => node[f] ?? null), itemStyle: { color: c.palette[0] } },
        { name: 'Network average', type: 'bar', data: SIG.map((f) => avg[f]), itemStyle: { color: c.palette[1] } },
      ],
    };
  }, [d, node, c]);

  if (net.status === 'missing') return <><PageHeader kicker="Collaboration Network" title="Who plays with whom" /><Card><DataMissing file="network.json" /></Card></>;

  return (
    <div>
      <PageHeader kicker="Collaboration Network" title="Who plays with whom">
        Artists are linked when they share a track. The view shows the {d ? d.nodes.length : ''} most connected artists, laid out and partitioned into
        Louvain communities in the analysis notebook (the notebook layout seeds a force layout for legibility). Click an artist to see its audio signature and collaborators.
      </PageHeader>
      {ns && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Artists (nodes)" value={fmtInt(ns.nodes)} hint={`${fmtInt(ns.collab_tracks)} collaboration tracks`} />
          <Stat label="Collaborations (edges)" value={fmtInt(ns.edges)} hint={`density ${ns.density?.toExponential?.(2) ?? '-'}`} />
          <Stat label="Giant component" value={`${fmtNum(ns.giant_share_pct, 1)}%`} hint={`${fmtInt(ns.giant_nodes)} artists; ${fmtInt(ns.components)} components`} />
          <Stat label="Communities" value={fmtInt(ns.communities)} hint={`modularity ${fmtNum(ns.modularity, 3)}`} />
        </div>
      )}
      {!d ? <Skeleton className="h-[600px]" /> : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card>
            <div className="p-3"><Chart option={option} height={620} onEvents={{ click: (p: any) => { if (p.dataType === 'node') setSel(p.data.id === sel ? '' : p.data.id); } }} ariaLabel="Network graph of artist collaborations coloured and shaped by community" /></div>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Find an artist" />
              <div className="p-4">
                <label htmlFor="artist-q" className="sr-only">Artist name</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-subtle" aria-hidden />
                  <input id="artist-q" className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artist in the network" />
                </div>
                {hits.length > 0 && <ul className="mt-2 divide-y divide-border rounded-lg border border-border">{hits.map((h) => <li key={h.id}><button type="button" className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setSel(h.id); setQ(''); }}>{h.id} <span className="text-xs text-subtle">degree {h.degree}</span></button></li>)}</ul>}
                {!node && ns?.top_degree && (
                  <div className="mt-4">
                    <div className="label">Most connected (whole network)</div>
                    <ul className="space-y-1 text-sm">{(ns.top_degree as [string, number][]).map(([a, k]) => <li key={a} className="flex justify-between"><button type="button" className="text-left hover:text-accent hover:underline" onClick={() => setSel(a)}>{a}</button><span className="font-mono text-xs text-subtle">{k}</span></li>)}</ul>
                  </div>
                )}
              </div>
            </Card>
            {node ? (
              <Card>
                <CardHeader title={node.id} subtitle={`Community ${node.community} - degree ${node.degree} - ${node.tracks} collaboration tracks - betweenness ${node.betweenness.toFixed(4)}`}
                  actions={<button type="button" className="btn-ghost btn-sm" onClick={() => setSel('')}>Clear</button>} />
                <div className="p-3">{sig && <Chart option={sig} height={220} ariaLabel={`Audio signature of ${node.id} compared with the network average`} />}</div>
                <div className="border-t border-border p-4">
                  <div className="label">Collaborators in view ({neighbours.length})</div>
                  <ul className="scrollbar-thin max-h-56 space-y-1 overflow-auto text-sm">
                    {neighbours.map((x) => <li key={x.artist} className="flex justify-between gap-2"><button type="button" className="truncate text-left hover:text-accent hover:underline" onClick={() => setSel(x.artist)}>{x.artist}</button><span className="font-mono text-xs text-subtle">{x.weight}</span></li>)}
                  </ul>
                </div>
              </Card>
            ) : <Card><EmptyState title="No artist selected">Click a node or search for an artist.</EmptyState></Card>}
          </div>
        </div>
      )}
    </div>
  );
}
