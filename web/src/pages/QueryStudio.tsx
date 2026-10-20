import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Download, Copy, History, Trash2, Wand2, SlidersHorizontal, Code2, RotateCcw, BarChart3 } from 'lucide-react';
import { Card, CardHeader, PageHeader, RangeSlider, MultiSelect, Segmented, Select, Skeleton, EmptyState, Notice, Spinner, fmtInt } from '../components/ui';
import { DataTable } from '../components/DataTable';
import { AUDIO_FEATURES, FEATURE_LABEL, KEYS, TRACK_COLUMNS, GENRE_COLUMNS, EMBED_COLUMNS, fmtFeature } from '../lib/features';
import { buildSql, toPandas, sqlToPandas, encodeFilter, decodeFilter, activeFilterCount, DEFAULT_FILTER, type FilterState } from '../lib/sqlBuilder';
import { parseQuery, ADJECTIVE_RULES } from '../lib/nlParser';
import { useDomains } from '../lib/domains';
import { useUrlState } from '../lib/urlState';
import { query, exportParquet, ensureTable, useDbState, type QueryResult } from '../lib/db';
import { download, copyText, toCSV } from '../lib/hooks';
import { loadHistory, pushHistory, clearHistory, setLastSql, type HistoryItem } from '../lib/history';

const SqlEditor = lazy(() => import('../components/SqlEditor'));

const EXAMPLES: { label: string; sql: string }[] = [
  { label: 'Average features by decade', sql: 'SELECT decade, COUNT(*) AS n,\n  ROUND(AVG(energy), 3) AS energy,\n  ROUND(AVG(acousticness), 3) AS acousticness,\n  ROUND(AVG(loudness), 2) AS loudness_db\nFROM tracks\nGROUP BY decade\nORDER BY decade' },
  { label: 'Most danceable tracks of the 2000s', sql: 'SELECT name, artist, year, danceability, energy, valence\nFROM tracks\nWHERE year BETWEEN 2000 AND 2009\nORDER BY danceability DESC\nLIMIT 50' },
  { label: 'Explicit share by decade', sql: 'SELECT decade, ROUND(100 * AVG(explicit::INT), 2) AS explicit_pct, COUNT(*) AS n\nFROM tracks\nGROUP BY decade\nORDER BY decade' },
  { label: 'Key / mode popularity', sql: 'SELECT key_name, COUNT(*) AS n,\n  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct\nFROM tracks\nGROUP BY key_name\nORDER BY n DESC' },
  { label: 'Cluster profiles', sql: 'SELECT cluster, COUNT(*) AS n,\n  ROUND(AVG(danceability), 3) AS dance, ROUND(AVG(energy), 3) AS energy,\n  ROUND(AVG(acousticness), 3) AS acoustic, ROUND(AVG(instrumentalness), 3) AS instr,\n  ROUND(AVG(speechiness), 3) AS speech\nFROM tracks\nGROUP BY cluster\nORDER BY cluster' },
  { label: 'Outliers vs inliers (speechiness)', sql: 'SELECT is_outlier, COUNT(*) AS n,\n  ROUND(AVG(speechiness), 3) AS mean_speechiness,\n  ROUND(MEDIAN(speechiness), 3) AS median_speechiness\nFROM tracks\nGROUP BY is_outlier' },
  { label: 'Prolific artists', sql: 'SELECT artist, COUNT(*) AS tracks, MIN(year) AS first, MAX(year) AS last\nFROM tracks\nGROUP BY artist\nORDER BY tracks DESC\nLIMIT 25' },
  { label: 'Genre table: most popular genres', sql: 'SELECT genre, COUNT(*) AS n, ROUND(AVG(popularity), 1) AS mean_popularity\nFROM genre_tracks\nGROUP BY genre\nORDER BY mean_popularity DESC\nLIMIT 20' },
  { label: 'Tempo histogram (10 BPM bins)', sql: 'SELECT FLOOR(tempo / 10) * 10 AS tempo_bin, COUNT(*) AS n\nFROM tracks\nGROUP BY tempo_bin\nORDER BY tempo_bin' },
];

const NL_EXAMPLES = [
  'energetic songs from the 1980s with low acousticness',
  'sad acoustic songs from the 70s',
  'top 20 most danceable songs after 2010',
  'clean instrumental tracks without outliers',
  'songs in c# minor with tempo over 140',
  'happy loud songs by queen',
];

type Tab = 'builder' | 'sql' | 'nl';

function needsGenreTable(sql: string) { return /\bgenre_tracks\b/i.test(sql); }
function needsEmbeddings(sql: string) { return /\bembeddings\b/i.test(sql); }

export default function QueryStudio() {
  const db = useDbState();
  const domains = useDomains();
  const [tab, setTab] = useUrlState<Tab>('t', 'builder');
  const [fRaw, setFRaw] = useUrlState<string>('f', '');
  const [sqlParam, setSqlParam] = useUrlState<string>('sql', '');
  const [nl, setNl] = useUrlState<string>('q', '');
  const filter = useMemo(() => decodeFilter(fRaw || null), [fRaw]);
  const setFilter = useCallback((f: FilterState) => setFRaw(encodeFilter(f) === '{}' ? '' : encodeFilter(f)), [setFRaw]);

  const [sqlText, setSqlText] = useState<string>(sqlParam || EXAMPLES[0].sql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [lastSql, setLast] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [toast, setToast] = useState<string | null>(null);
  const runId = useRef(0);

  // If the URL contains ?sql=..., open the console with it
  useEffect(() => { if (sqlParam) { setSqlText(sqlParam); if (tab === 'builder') setTab('sql'); } /* eslint-disable-next-line */ }, []);

  const builderSql = useMemo(() => buildSql(filter), [filter]);
  const parsed = useMemo(() => parseQuery(nl, { genres: domains?.genres ?? [] }), [nl, domains]);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2200); };

  const run = useCallback(async (sql: string, record = true) => {
    const id = ++runId.current;
    setRunning(true); setError(null);
    try {
      if (needsGenreTable(sql)) await ensureTable('genre_tracks');
      if (needsEmbeddings(sql)) await ensureTable('embeddings');
      const r = await query(sql);
      if (id !== runId.current) return;
      setResult(r); setLast(sql); setLastSql(sql);
      if (record) setHistory(pushHistory({ sql, ts: Date.now(), ms: r.ms, rows: r.rows.length }));
    } catch (e: any) {
      if (id !== runId.current) return;
      setError(String(e?.message ?? e)); setResult(null);
    } finally {
      if (id === runId.current) setRunning(false);
    }
  }, []);

  // Auto-run the visual builder (debounced)
  useEffect(() => {
    if (tab !== 'builder' || db.phase !== 'ready') return;
    const t = window.setTimeout(() => void run(builderSql, false), 250);
    return () => window.clearTimeout(t);
  }, [builderSql, tab, db.phase, db.source, run]);

  // Run console SQL / NL once ready
  useEffect(() => {
    if (db.phase !== 'ready') return;
    if (tab === 'sql' && !result) void run(sqlText, false);
    if (tab === 'nl' && nl) void run(parsed.sql, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.phase, tab]);

  const runConsole = useCallback(() => { setSqlParam(sqlText.trim() === EXAMPLES[0].sql ? '' : sqlText); void run(sqlText); }, [sqlText, run, setSqlParam]);

  const schema = useMemo(() => ({ tracks: TRACK_COLUMNS, tracks_lite: TRACK_COLUMNS, genre_tracks: GENRE_COLUMNS, embeddings: EMBED_COLUMNS }), []);

  const currentSql = tab === 'builder' ? builderSql : tab === 'nl' ? parsed.sql : sqlText;
  const pandas = tab === 'builder' ? toPandas(filter) : sqlToPandas(currentSql);

  const exportAs = async (fmt: 'csv' | 'json' | 'parquet') => {
    if (!result) return;
    if (fmt === 'csv') download('sonicatlas_query.csv', toCSV(result.columns, result.rows), 'text/csv');
    if (fmt === 'json') download('sonicatlas_query.json', JSON.stringify(result.rows, null, 1), 'application/json');
    if (fmt === 'parquet') {
      try { const b = await exportParquet(lastSql); download('sonicatlas_query.parquet', b as unknown as BlobPart, 'application/octet-stream'); }
      catch (e: any) { flash('Parquet export failed: ' + (e?.message ?? e)); }
    }
  };

  const setRange = (f: string, v: [number, number]) => {
    const d = domains?.ranges[f];
    const ranges = { ...filter.ranges };
    if (d && v[0] <= d[0] && v[1] >= d[1]) delete ranges[f];
    else ranges[f] = v;
    setFilter({ ...filter, ranges });
  };

  return (
    <div>
      <PageHeader kicker="Query Studio" title="Ask the catalogue anything"
        actions={<Link to={`/profile?sql=${encodeURIComponent(lastSql || currentSql)}`} className="btn-secondary"><BarChart3 className="h-4 w-4" aria-hidden /> Profile this result</Link>}>
        Build filters visually, write DuckDB SQL, or type a question in plain English. Everything runs locally on the{' '}
        {db.source === 'full' ? 'full 1.2M-row dataset' : '150,000-track sample'} in a Web Worker.
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented<Tab> label="Query mode" hideLabel value={tab} onChange={setTab} options={[
          { value: 'builder', label: <span className="inline-flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />Visual builder</span> },
          { value: 'sql', label: <span className="inline-flex items-center gap-1.5"><Code2 className="h-3.5 w-3.5" aria-hidden />SQL console</span> },
          { value: 'nl', label: <span className="inline-flex items-center gap-1.5"><Wand2 className="h-3.5 w-3.5" aria-hidden />Plain English</span> },
        ]} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        {/* LEFT: input panel */}
        <div className="space-y-4">
          {tab === 'builder' && (
            <Card>
              <CardHeader title="Filters" subtitle={`${activeFilterCount(filter)} active - auto-runs as you change them`}
                actions={<button type="button" className="btn-ghost btn-sm" onClick={() => setFilter({ ...DEFAULT_FILTER, ranges: {} })}><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset</button>} />
              {!domains ? (
                <div className="space-y-3 p-5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8" />)}</div>
              ) : (
                <div className="space-y-5 p-5">
                  <div>
                    <label className="label" htmlFor="artist-search">Artist contains</label>
                    <input id="artist-search" className="input" placeholder="e.g. Beatles" value={filter.artist} onChange={(e) => setFilter({ ...filter, artist: e.target.value })} />
                  </div>
                  <RangeSlider label="Year" min={domains.ranges.year[0]} max={domains.ranges.year[1]} step={1}
                    value={filter.year ?? domains.ranges.year}
                    onChange={(v) => setFilter({ ...filter, year: v[0] <= domains.ranges.year[0] && v[1] >= domains.ranges.year[1] ? null : v })} />
                  <div className="space-y-4">
                    {AUDIO_FEATURES.map((f) => (
                      <RangeSlider key={f} label={FEATURE_LABEL[f]} min={domains.ranges[f][0]} max={domains.ranges[f][1]} step={domains.steps[f]}
                        value={(filter.ranges[f] as [number, number]) ?? domains.ranges[f]} onChange={(v) => setRange(f, v)} format={(v) => fmtFeature(f, v)} />
                    ))}
                  </div>
                  <MultiSelect label={`Genre (${domains.genres.length} genres; sparse in this table)`} options={domains.genres} value={filter.genres} onChange={(g) => setFilter({ ...filter, genres: g })} />
                  <MultiSelect label="Key" options={KEYS} value={filter.keys} onChange={(k) => setFilter({ ...filter, keys: k })} />
                  <Segmented label="Mode" value={filter.mode} onChange={(m) => setFilter({ ...filter, mode: m })} options={[{ value: 'any', label: 'Any' }, { value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }]} />
                  <Segmented label="Explicit" value={filter.explicit} onChange={(m) => setFilter({ ...filter, explicit: m })} options={[{ value: 'any', label: 'Any' }, { value: 'yes', label: 'Explicit' }, { value: 'no', label: 'Clean' }]} />
                  <Segmented label="Isolation-forest outliers" value={filter.outliers} onChange={(m) => setFilter({ ...filter, outliers: m })} options={[{ value: 'include', label: 'Include' }, { value: 'exclude', label: 'Exclude' }, { value: 'only', label: 'Only' }]} />
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Sort by" value={filter.orderBy ?? ''} onChange={(v) => setFilter({ ...filter, orderBy: v || undefined })}
                      options={[{ value: '', label: 'None' }, ...['year', 'name', 'artist', ...AUDIO_FEATURES].map((c) => ({ value: c, label: FEATURE_LABEL[c] ?? c }))]} />
                    <Select label="Direction" value={filter.orderDir ?? 'desc'} onChange={(v) => setFilter({ ...filter, orderDir: v as 'asc' | 'desc' })}
                      options={[{ value: 'desc', label: 'Descending' }, { value: 'asc', label: 'Ascending' }]} />
                  </div>
                  <Select label="Row limit" value={String(filter.limit)} onChange={(v) => setFilter({ ...filter, limit: Number(v) })}
                    options={[100, 500, 1000, 5000, 20000].map((n) => ({ value: String(n), label: n.toLocaleString('en-US') }))} />
                </div>
              )}
            </Card>
          )}

          {tab === 'sql' && (
            <>
              <Card>
                <CardHeader title="Example queries" subtitle="Click to load into the console" />
                <ul className="divide-y divide-border">
                  {EXAMPLES.map((e) => (
                    <li key={e.label}>
                      <button type="button" className="w-full px-5 py-2.5 text-left text-sm hover:bg-muted" onClick={() => { setSqlText(e.sql); void run(e.sql); }}>{e.label}</button>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardHeader title="Query history" subtitle="Stored in this browser only"
                  actions={history.length > 0 && <button type="button" className="btn-ghost btn-sm" onClick={() => { clearHistory(); setHistory([]); }}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear</button>} />
                {history.length === 0 ? <EmptyState title="No queries yet">Run a query and it will appear here.</EmptyState> : (
                  <ul className="scrollbar-thin max-h-72 divide-y divide-border overflow-auto">
                    {history.map((h) => (
                      <li key={h.ts}>
                        <button type="button" className="w-full px-5 py-2 text-left hover:bg-muted" onClick={() => setSqlText(h.sql)}>
                          <code className="line-clamp-2 block font-mono text-xs text-fg">{h.sql}</code>
                          <span className="text-[11px] text-subtle">{new Date(h.ts).toLocaleTimeString()} - {fmtInt(h.rows)} rows - {h.ms.toFixed(0)} ms</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}

          {tab === 'nl' && (
            <Card>
              <CardHeader title="Rule book" subtitle="The parser is transparent: these fixed rules map words to SQL" />
              <div className="scrollbar-thin max-h-[520px] overflow-auto px-5 py-3 text-xs">
                <ul className="space-y-1.5">
                  <li><b>Decades:</b> 1980s, 80s, eighties, early/mid/late 1990s</li>
                  <li><b>Years:</b> in 1999, after 2010, before 1970, between 1995 and 2005</li>
                  <li><b>Keys:</b> in C# minor, in Eb major, key of D</li>
                  <li><b>Numbers:</b> tempo over 120, energy above 0.8, longer than 6 minutes</li>
                  <li><b>Artist:</b> by &lt;name&gt; (substring match)</li>
                  <li><b>Genres:</b> any of the labelled genre names</li>
                  <li><b>Sorting:</b> most danceable, saddest, fastest, newest, sorted by tempo</li>
                  <li><b>Limits:</b> top 20, 50 songs</li>
                  {ADJECTIVE_RULES.map((r) => <li key={r.rule}><code className="font-mono">{r.words.slice(0, 3).join(', ')}</code> &rarr; {r.sql}</li>)}
                </ul>
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT: editor + results */}
        <div className="min-w-0 space-y-4">
          {tab === 'sql' && (
            <Card>
              <CardHeader title="SQL console" subtitle={<>Tables: <code>tracks</code>, <code>genre_tracks</code>, <code>embeddings</code>. Press <span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> to run.</>}
                actions={<button type="button" className="btn-primary" onClick={runConsole} disabled={running || db.phase !== 'ready'} data-testid="run-sql">{running ? <Spinner /> : <Play className="h-4 w-4" aria-hidden />} Run</button>} />
              <div className="p-4">
                <Suspense fallback={<Skeleton className="h-40" label="Loading editor" />}>
                  <SqlEditor value={sqlText} onChange={setSqlText} onRun={runConsole} schema={schema} label="SQL query editor" />
                </Suspense>
              </div>
            </Card>
          )}

          {tab === 'nl' && (
            <Card>
              <CardHeader title="Plain-English query" subtitle="Rule-based, no AI and no network: you always see the SQL it generates" />
              <form className="space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); void run(parsed.sql); }}>
                <label htmlFor="nl-input" className="sr-only">Describe the songs you want</label>
                <div className="flex gap-2">
                  <input id="nl-input" className="input" placeholder="e.g. energetic songs from the 1980s with low acousticness" value={nl} onChange={(e) => setNl(e.target.value)} data-testid="nl-input" />
                  <button type="submit" className="btn-primary" disabled={db.phase !== 'ready'}><Wand2 className="h-4 w-4" aria-hidden /> Translate & run</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {NL_EXAMPLES.map((x) => <button key={x} type="button" className="chip hover:bg-border" onClick={() => { setNl(x); void run(parseQuery(x, { genres: domains?.genres ?? [] }).sql); }}>{x}</button>)}
                </div>
                {nl && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="label">Understood</div>
                      {parsed.conditions.length === 0 && !parsed.orderBy ? <p className="text-sm text-subtle">No rule matched yet.</p> : (
                        <ul className="space-y-1 text-sm">
                          {parsed.conditions.map((c) => <li key={c.sql}><span className="chip">{c.phrase}</span> <code className="ml-1 font-mono text-xs">{c.sql}</code></li>)}
                          {parsed.orderBy && <li><span className="chip">sort</span> <code className="ml-1 font-mono text-xs">ORDER BY {parsed.orderBy}</code></li>}
                        </ul>
                      )}
                      {parsed.unmatched.length > 0 && <p className="mt-2 text-xs text-subtle">Ignored words: {parsed.unmatched.join(', ')}</p>}
                    </div>
                    <div>
                      <div className="label">Generated SQL</div>
                      <pre className="scrollbar-thin overflow-auto rounded-lg bg-muted p-3 font-mono text-xs" data-testid="nl-sql">{parsed.sql}</pre>
                      <button type="button" className="btn-ghost btn-sm mt-1" onClick={() => { setSqlText(parsed.sql); setTab('sql'); }}>Open in SQL console</button>
                    </div>
                  </div>
                )}
              </form>
            </Card>
          )}

          {tab === 'builder' && (
            <Card>
              <CardHeader title="Generated SQL" subtitle="Updates live from the filters" actions={<button type="button" className="btn-ghost btn-sm" onClick={() => { setSqlText(builderSql); setTab('sql'); }}><Code2 className="h-3.5 w-3.5" aria-hidden /> Edit as SQL</button>} />
              <pre className="scrollbar-thin overflow-auto px-5 py-3 font-mono text-xs" data-testid="builder-sql">{builderSql}</pre>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Results"
              subtitle={result ? <span data-testid="query-meta">{fmtInt(result.rows.length)} rows - {result.columns.length} columns - <b>{result.ms.toFixed(1)} ms</b> in DuckDB-WASM</span> : running ? 'Running...' : 'No results yet'}
              actions={
                <>
                  <button type="button" className="btn-secondary btn-sm" disabled={!result} onClick={() => exportAs('csv')}><Download className="h-3.5 w-3.5" aria-hidden /> CSV</button>
                  <button type="button" className="btn-secondary btn-sm" disabled={!result} onClick={() => exportAs('json')}><Download className="h-3.5 w-3.5" aria-hidden /> JSON</button>
                  <button type="button" className="btn-secondary btn-sm" disabled={!result} onClick={() => exportAs('parquet')}><Download className="h-3.5 w-3.5" aria-hidden /> Parquet</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={async () => flash((await copyText(currentSql)) ? 'SQL copied' : 'Copy failed')}><Copy className="h-3.5 w-3.5" aria-hidden /> Copy as SQL</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={async () => flash((await copyText(pandas)) ? 'pandas code copied' : 'Copy failed')}><Copy className="h-3.5 w-3.5" aria-hidden /> Copy as pandas</button>
                </>
              }
            />
            <div className="p-4">
              {toast && <div className="mb-3"><Notice>{toast}</Notice></div>}
              {error && <div className="mb-3"><Notice tone="error"><b>Query error:</b> <span className="font-mono text-xs">{error}</span></Notice></div>}
              {db.phase === 'error' ? (
                <EmptyState title="Data not available yet" icon="data">tracks_lite.parquet could not be loaded. Export the web data and reload.</EmptyState>
              ) : !result && (running || db.phase !== 'ready') ? (
                <div className="space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
              ) : result && result.rows.length === 0 ? (
                <EmptyState title="No rows match">Loosen a filter or change the query.</EmptyState>
              ) : result ? (
                <div data-testid="results-table" className={running ? 'opacity-60 transition-opacity' : ''}>
                  <DataTable columns={result.columns} rows={result.rows} caption="Query results" />
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-subtle"><History className="h-3.5 w-3.5" aria-hidden /> The page URL encodes the current filters, SQL and plain-English text, so you can bookmark or share it.</p>
    </div>
  );
}
