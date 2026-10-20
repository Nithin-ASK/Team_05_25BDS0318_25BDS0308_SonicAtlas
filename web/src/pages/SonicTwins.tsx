import { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Card, CardHeader, PageHeader, Segmented, Skeleton, EmptyState, Notice, fmtNum } from '../components/ui';
import { Chart, useChartColors } from '../components/Chart';
import { DataTable } from '../components/DataTable';
import { useUrlState } from '../lib/urlState';
import { ensureTable, query, useDbState } from '../lib/db';
import { PROFILE_FEATURES, FEATURE_LABEL, fmtFeature, UNIT_FEATURES } from '../lib/features';
import { boundsSql, parseBounds, similaritySql, scale, type Bounds } from '../lib/similarity';
import { quoteString, likeEscape } from '../lib/sqlBuilder';
import { DASHES } from '../lib/palette';

type Mode = 'track' | 'profile';
interface Track { id: string; name: string; artist: string; year?: number; genre?: string; [k: string]: unknown }

export default function SonicTwins() {
  const db = useDbState();
  const c = useChartColors();
  const [mode, setMode] = useUrlState<Mode>('mode', 'track');
  const [id, setId] = useUrlState<string>('id', '');
  const [profileRaw, setProfileRaw] = useUrlState<Record<string, number> | null>('p', null);
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<Track[] | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [target, setTarget] = useState<Track | null>(null);
  const [matches, setMatches] = useState<Track[] | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // bounds for the active source
  useEffect(() => {
    if (db.phase !== 'ready') return;
    query(boundsSql('tracks')).then((r) => setBounds(parseBounds(r.rows[0]))).catch((e) => setErr(String(e.message ?? e)));
  }, [db.phase, db.source]);

  // default profile = midpoint of each bound
  const profile = useMemo(() => {
    if (!bounds) return null;
    const p: Record<string, number> = {};
    for (const f of PROFILE_FEATURES) p[f] = profileRaw?.[f] ?? Number(((bounds[f][0] + bounds[f][1]) / 2).toFixed(2));
    return p;
  }, [bounds, profileRaw]);

  // search
  useEffect(() => {
    if (db.phase !== 'ready' || search.trim().length < 2) { setHits(null); return; }
    const t = window.setTimeout(async () => {
      const s = quoteString('%' + likeEscape(search.trim()) + '%');
      const r = await query(`SELECT id, name, artist, year, genre FROM tracks WHERE name ILIKE ${s} ESCAPE '\\' OR artist ILIKE ${s} ESCAPE '\\' ORDER BY (name ILIKE ${s} ESCAPE '\\') DESC, year DESC LIMIT 12`);
      setHits(r.rows as Track[]);
    }, 200);
    return () => window.clearTimeout(t);
  }, [search, db.phase]);

  // resolve target track (from tracks, then embeddings / genre table)
  useEffect(() => {
    if (mode !== 'track' || !id || db.phase !== 'ready') { setTarget(null); return; }
    let alive = true;
    (async () => {
      const cols = `id, name, artist, ${PROFILE_FEATURES.join(', ')}`;
      let r = await query(`SELECT ${cols}, year, genre FROM tracks WHERE id = ${quoteString(id)} LIMIT 1`);
      if (!r.rows.length && await ensureTable('genre_tracks')) r = await query(`SELECT ${cols}, year, genre FROM genre_tracks WHERE id = ${quoteString(id)} LIMIT 1`);
      if (!r.rows.length && await ensureTable('embeddings')) r = await query(`SELECT ${cols}, NULL AS year, genre FROM embeddings WHERE id = ${quoteString(id)} LIMIT 1`);
      if (alive) setTarget((r.rows[0] as Track) ?? null);
    })().catch((e) => setErr(String(e.message ?? e)));
    return () => { alive = false; };
  }, [id, mode, db.phase, db.source]);

  // nearest neighbours
  const targetVec = mode === 'track' ? target : profile;
  useEffect(() => {
    if (!bounds || !targetVec) { setMatches(null); return; }
    let alive = true;
    const vec: Record<string, number> = {};
    for (const f of PROFILE_FEATURES) vec[f] = Number((targetVec as any)[f]);
    if (PROFILE_FEATURES.some((f) => !Number.isFinite(vec[f]))) return;
    const sql = similaritySql(vec, bounds, { excludeId: mode === 'track' ? id : undefined, limit: 25 });
    const t0 = performance.now();
    query(sql).then((r) => { if (alive) { setMatches(r.rows as Track[]); setMs(performance.now() - t0); } }).catch((e) => setErr(String(e.message ?? e)));
    return () => { alive = false; };
  }, [bounds, targetVec, mode, id]);

  const radar = useMemo(() => {
    if (!bounds || !targetVec || !matches?.length) return null;
    const top = matches.slice(0, 3);
    const items = [{ name: mode === 'track' ? `Target: ${(targetVec as Track).name}` : 'Target profile', v: targetVec as any }, ...top.map((m) => ({ name: `${m.name} - ${m.artist}`, v: m as any }))];
    return {
      legend: { bottom: 0, type: 'scroll' },
      tooltip: { trigger: 'item' },
      radar: { indicator: PROFILE_FEATURES.map((f) => ({ name: FEATURE_LABEL[f].replace(/ \(.*\)/, ''), max: 1, min: 0 })), radius: '62%', axisName: { color: c.subtle }, splitLine: { lineStyle: { color: c.grid } }, splitArea: { show: false }, axisLine: { lineStyle: { color: c.grid } } },
      series: [{
        type: 'radar',
        data: items.map((it, i) => ({
          name: it.name.length > 48 ? it.name.slice(0, 46) + '...' : it.name,
          value: PROFILE_FEATURES.map((f) => Number(scale(Number(it.v[f]), bounds[f]).toFixed(3))),
          lineStyle: { width: i === 0 ? 3 : 1.5, type: DASHES[i % DASHES.length] as any, color: c.palette[i] },
          itemStyle: { color: c.palette[i] },
          areaStyle: i === 0 ? { opacity: 0.12 } : undefined,
          symbol: ['circle', 'rect', 'triangle', 'diamond'][i],
        })),
      }],
    };
  }, [bounds, targetVec, matches, mode, c]);

  const rows = useMemo(() => (matches ?? []).map((m) => ({ similarity: Number((Number(m.similarity) * 100).toFixed(2)), name: m.name, artist: m.artist, year: m.year, genre: m.genre, ...Object.fromEntries(PROFILE_FEATURES.map((f) => [f, m[f]])), id: m.id })), [matches]);

  return (
    <div>
      <PageHeader kicker="Sonic Twins" title="Find tracks that sound alike">
        Nearest neighbours by cosine similarity on the nine min-max scaled audio features, computed in SQL over the {db.source === 'full' ? 'full dataset' : '150,000-track sample'}.
      </PageHeader>
      <div className="mb-4"><Segmented<Mode> label="Search by" value={mode} onChange={setMode} options={[{ value: 'track', label: 'A track' }, { value: 'profile', label: 'A target profile' }]} /></div>
      {err && <div className="mb-4"><Notice tone="error">{err}</Notice></div>}
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          {mode === 'track' ? (
            <>
              <CardHeader title="Pick a track" subtitle="Search by title or artist" />
              <div className="p-5">
                <label htmlFor="twin-search" className="sr-only">Search tracks</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-subtle" aria-hidden />
                  <input id="twin-search" className="input pl-9" placeholder="e.g. Bohemian Rhapsody" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="twin-search" />
                </div>
                {hits && (
                  <ul className="mt-2 divide-y divide-border rounded-lg border border-border" aria-label="Search results">
                    {hits.length === 0 && <li className="px-3 py-2 text-sm text-subtle">No tracks found</li>}
                    {hits.map((h) => (
                      <li key={h.id}>
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setId(h.id); setSearch(''); setHits(null); }}>
                          <span className="font-medium">{h.name}</span> <span className="text-subtle">- {h.artist}{h.year ? ` (${h.year})` : ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {target ? (
                  <div className="mt-5 rounded-lg bg-muted p-4" data-testid="twin-target">
                    <div className="text-xs uppercase tracking-wide text-subtle">Target</div>
                    <div className="mt-1 font-semibold">{target.name}</div>
                    <div className="text-sm text-subtle">{target.artist}{target.year ? ` - ${target.year}` : ''}{target.genre ? ` - ${target.genre}` : ''}</div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {PROFILE_FEATURES.map((f) => <div key={f} className="flex justify-between"><dt className="text-subtle">{FEATURE_LABEL[f].replace(/ \(.*\)/, '')}</dt><dd className="font-mono">{fmtFeature(f, Number(target[f]))}</dd></div>)}
                    </dl>
                  </div>
                ) : !id ? (
                  <div className="mt-4">
                    <p className="text-sm text-subtle">Or try a random track:</p>
                    <button type="button" className="btn-secondary mt-2" disabled={db.phase !== 'ready'} data-testid="random-track"
                      onClick={async () => { const r = await query('SELECT id FROM tracks USING SAMPLE 1 ROWS'); if (r.rows[0]) setId(String(r.rows[0].id)); }}>
                      <Sparkles className="h-4 w-4" aria-hidden /> Surprise me
                    </button>
                  </div>
                ) : <Skeleton className="mt-4 h-40" />}
              </div>
            </>
          ) : (
            <>
              <CardHeader title="Target profile" subtitle="Slider ranges come from the data min / max" />
              <div className="space-y-4 p-5">
                {!bounds || !profile ? <Skeleton className="h-80" /> : PROFILE_FEATURES.map((f) => {
                  const st = UNIT_FEATURES.has(f) ? 0.01 : f === 'tempo' ? 1 : 0.5;
                  return (
                    <div key={f}>
                      <div className="mb-1 flex justify-between text-xs"><label htmlFor={`p-${f}`} className="font-medium text-subtle">{FEATURE_LABEL[f]}</label><span className="font-mono">{fmtFeature(f, profile[f])}</span></div>
                      <input id={`p-${f}`} type="range" className="single" min={bounds[f][0]} max={bounds[f][1]} step={st} value={profile[f]}
                        onChange={(e) => setProfileRaw({ ...profile, [f]: Number(e.target.value) })} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Radar comparison" subtitle="Target vs the three closest tracks (features scaled 0-1 by data min / max)" />
            <div className="p-3">
              {radar ? <Chart option={radar} height={380} ariaLabel="Radar chart comparing the target with the three most similar tracks" /> :
                (mode === 'track' && !id) ? <EmptyState title="Pick a track to begin" /> : <Skeleton className="h-[380px]" />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Nearest tracks" subtitle={matches ? <span data-testid="twin-meta">{matches.length} matches - similarity in % - query {ms?.toFixed(0)} ms</span> : 'Waiting for a target'} />
            <div className="p-4">
              {matches ? (
                <div data-testid="twin-results">
                  <DataTable columns={['similarity', 'name', 'artist', 'year', 'genre', ...PROFILE_FEATURES]} rows={rows} pageSize={10} caption="Most similar tracks"
                    onRowClick={(r) => { setMode('track'); setId(String(r.id)); }} rowLabel={(r) => `Use ${r.name} as the new target`} />
                  <p className="mt-2 text-xs text-subtle">Top similarity: {fmtNum(rows[0]?.similarity, 2)}%. Cosine similarity of non-negative scaled vectors is always between 0 and 1, so differences at the top are small; use the radar to judge the fit. Click a row to hop to that track.</p>
                </div>
              ) : (mode === 'track' && !id) ? <EmptyState title="No target yet">Search for a song, click "Surprise me", or switch to a target profile.</EmptyState> : <Skeleton className="h-60" />}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
