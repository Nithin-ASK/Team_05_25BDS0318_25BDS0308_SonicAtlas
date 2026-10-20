/**
 * DuckDB-WASM, running in its own Web Worker. The worker and wasm files are bundled
 * locally by Vite (?url imports) so the site works offline and on any static host.
 */
import * as duckdb from '@duckdb/duckdb-wasm';
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { DATA_BASE, DATA_FILES, FULL_DATA_URL } from '../config';
import { useSyncExternalStore } from 'react';

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
};

export type TableName = 'tracks_lite' | 'genre_tracks' | 'embeddings';
const TABLE_FILES: Record<TableName, string> = {
  tracks_lite: DATA_FILES.tracks,
  genre_tracks: DATA_FILES.genre,
  embeddings: DATA_FILES.embeddings,
};

export interface DbState {
  phase: 'idle' | 'engine' | 'data' | 'ready' | 'error';
  progress: number; // 0..1
  message: string;
  error?: string;
  tables: Partial<Record<TableName | 'tracks_full', 'loading' | 'ready' | 'missing' | 'error'>>;
  rows?: number;
  source: 'lite' | 'full';
  loadMs?: number;
}

let state: DbState = { phase: 'idle', progress: 0, message: 'Idle', tables: {}, source: 'lite' };
const listeners = new Set<() => void>();
function set(p: Partial<DbState>) {
  state = { ...state, ...p, tables: { ...state.tables, ...(p.tables ?? {}) } };
  listeners.forEach((l) => l());
}
export function getDbState() { return state; }
export function subscribeDb(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useDbState(): DbState { return useSyncExternalStore(subscribeDb, getDbState, getDbState); }

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;
let connPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;
const tablePromises = new Map<string, Promise<boolean>>();

function absolute(u: string) { return new URL(u, document.baseURI).href; }

async function instantiate(): Promise<duckdb.AsyncDuckDB> {
  set({ phase: 'engine', progress: 0.02, message: 'Starting the SQL engine (DuckDB-WASM)' });
  const bundle = await duckdb.selectBundle(BUNDLES);
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker, (p) => {
    if (p.bytesTotal > 0) set({ progress: 0.02 + 0.48 * Math.min(1, p.bytesLoaded / p.bytesTotal) });
  });
  return db;
}

export function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = instantiate().catch((e) => {
      set({ phase: 'error', error: String(e?.message ?? e), message: 'SQL engine failed to start' });
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

export function getConn(): Promise<duckdb.AsyncDuckDBConnection> {
  if (!connPromise) connPromise = getDb().then((db) => db.connect());
  return connPromise;
}

/** Fetch a file with byte-level progress. Returns null if it is missing or not parquet. */
async function fetchBytes(url: string, onProgress: (f: number) => void): Promise<Uint8Array | null> {
  let res: Response;
  try { res = await fetch(url); } catch { return null; }
  if (!res.ok) return null;
  const total = Number(res.headers.get('content-length')) || 0;
  if (!res.body) {
    const b = new Uint8Array(await res.arrayBuffer());
    onProgress(1);
    return b;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total) onProgress(Math.min(1, got / total));
  }
  const out = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  onProgress(1);
  return out;
}

function isParquet(b: Uint8Array | null): b is Uint8Array {
  return !!b && b.length > 8 && b[0] === 0x50 && b[1] === 0x41 && b[2] === 0x52 && b[3] === 0x31;
}

/** Load one exported parquet file into an in-memory DuckDB table (once). */
export function ensureTable(name: TableName): Promise<boolean> {
  const existing = tablePromises.get(name);
  if (existing) return existing;
  const p = (async () => {
    const isMain = name === 'tracks_lite';
    set({ tables: { [name]: 'loading' } });
    const db = await getDb();
    if (isMain) set({ phase: 'data', progress: 0.5, message: 'Downloading tracks_lite.parquet' });
    const t0 = performance.now();
    const bytes = await fetchBytes(absolute(DATA_BASE + TABLE_FILES[name]), (f) => {
      if (isMain) set({ progress: 0.5 + 0.45 * f });
    });
    if (!isParquet(bytes)) {
      set({ tables: { [name]: 'missing' }, ...(isMain ? { phase: 'error', error: 'missing', message: `${TABLE_FILES[name]} is not available yet` } : {}) });
      tablePromises.delete(name);
      return false;
    }
    await db.registerFileBuffer(TABLE_FILES[name], bytes);
    const conn = await getConn();
    if (isMain) set({ progress: 0.96, message: 'Building the in-memory table' });
    await conn.query(`CREATE OR REPLACE TABLE ${name} AS SELECT * FROM read_parquet('${TABLE_FILES[name]}')`);
    if (isMain) {
      await conn.query('CREATE OR REPLACE VIEW tracks AS SELECT * FROM tracks_lite');
      const r = await conn.query('SELECT COUNT(*)::INTEGER AS n FROM tracks_lite');
      set({ phase: 'ready', progress: 1, message: 'Ready', rows: Number(r.toArray()[0].n), loadMs: performance.now() - t0, source: 'lite' });
    }
    set({ tables: { [name]: 'ready' } });
    return true;
  })().catch((e) => {
    tablePromises.delete(name);
    set({ tables: { [name]: 'error' }, ...(name === 'tracks_lite' ? { phase: 'error', error: String(e?.message ?? e), message: 'Failed to load data' } : {}) });
    return false;
  });
  tablePromises.set(name, p);
  return p;
}

/** Start the engine and the main table; resolves true when "tracks" is queryable. */
export function initMain(): Promise<boolean> { return ensureTable('tracks_lite'); }

/** Switch the "tracks" view between the 150k lite table and the 1.2M full file (HTTP range reads). */
export async function setSource(source: 'lite' | 'full'): Promise<void> {
  await initMain();
  const db = await getDb();
  const conn = await getConn();
  if (source === 'lite') {
    await conn.query('CREATE OR REPLACE VIEW tracks AS SELECT * FROM tracks_lite');
    const r = await conn.query('SELECT COUNT(*)::INTEGER AS n FROM tracks');
    set({ source: 'lite', rows: Number(r.toArray()[0].n) });
    return;
  }
  set({ tables: { tracks_full: 'loading' } });
  try {
    const url = absolute(FULL_DATA_URL);
    const head = await fetch(url, { headers: { Range: 'bytes=0-15' } });
    let magic = new Uint8Array(0);
    if (head.ok && head.body) {
      const reader = head.body.getReader();
      const first = await reader.read();
      magic = first.value ?? magic;
      void reader.cancel();
    }
    if (!(magic[0] === 0x50 && magic[1] === 0x41 && magic[2] === 0x52 && magic[3] === 0x31)) throw new Error('Full dataset not reachable at ' + FULL_DATA_URL);
    await db.registerFileURL('tracks_full.parquet', url, duckdb.DuckDBDataProtocol.HTTP, false);
    const desc = await conn.query("DESCRIBE SELECT * FROM read_parquet('tracks_full.parquet')");
    const have = new Set(desc.toArray().map((r: any) => String(r.column_name)));
    const liteDesc = await conn.query('DESCRIBE tracks_lite');
    const extras = liteDesc.toArray()
      .filter((r: any) => !have.has(String(r.column_name)))
      .map((r: any) => `CAST(NULL AS ${r.column_type}) AS ${r.column_name}`);
    await conn.query(`CREATE OR REPLACE VIEW tracks AS SELECT *${extras.length ? ', ' + extras.join(', ') : ''} FROM read_parquet('tracks_full.parquet')`);
    const r = await conn.query('SELECT COUNT(*)::INTEGER AS n FROM tracks');
    set({ source: 'full', rows: Number(r.toArray()[0].n), tables: { tracks_full: 'ready' } });
  } catch (e) {
    set({ tables: { tracks_full: 'missing' } });
    await conn.query('CREATE OR REPLACE VIEW tracks AS SELECT * FROM tracks_lite');
    set({ source: 'lite' });
    throw e;
  }
}

export interface QueryResult {
  columns: string[];
  types: string[];
  rows: Record<string, unknown>[];
  ms: number;
}

function plain(v: unknown): unknown {
  if (typeof v === 'bigint') return Number(v);
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === 'object' && 'toJSON' in (v as object) && !(Array.isArray(v))) {
    try { return (v as { toJSON(): unknown }).toJSON(); } catch { return String(v); }
  }
  return v;
}

/** Run SQL and return plain JS rows. */
export async function query(sql: string): Promise<QueryResult> {
  const conn = await getConn();
  const t0 = performance.now();
  const table = await conn.query(sql);
  const ms = performance.now() - t0;
  const fields = table.schema.fields;
  const columns = fields.map((f) => f.name);
  const types = fields.map((f) => String(f.type));
  const n = table.numRows;
  const cols = columns.map((_, i) => table.getChildAt(i));
  const rows: Record<string, unknown>[] = new Array(n);
  for (let r = 0; r < n; r++) {
    const o: Record<string, unknown> = {};
    for (let c = 0; c < columns.length; c++) o[columns[c]] = plain(cols[c]?.get(r));
    rows[r] = o;
  }
  return { columns, types, rows, ms };
}

/** Run SQL and return columns as arrays (fast path for charts). */
export async function queryColumns(sql: string): Promise<{ cols: Record<string, any[]>; n: number; ms: number }> {
  const conn = await getConn();
  const t0 = performance.now();
  const table = await conn.query(sql);
  const ms = performance.now() - t0;
  const cols: Record<string, any[]> = {};
  table.schema.fields.forEach((f, i) => {
    const v = table.getChildAt(i);
    const arr = v ? v.toArray() : [];
    // Typed arrays of BigInt -> numbers; Arrow string vectors -> string[]
    cols[f.name] = Array.from(arr as ArrayLike<unknown>, (x) => (typeof x === 'bigint' ? Number(x) : x));
  });
  return { cols, n: table.numRows, ms };
}

/** Export a query as parquet bytes via DuckDB COPY. */
export async function exportParquet(sql: string): Promise<Uint8Array> {
  const db = await getDb();
  const conn = await getConn();
  const name = `export_${Date.now()}.parquet`;
  await conn.query(`COPY (${sql.replace(/;\s*$/, '')}) TO '${name}' (FORMAT PARQUET, COMPRESSION ZSTD)`);
  const buf = await db.copyFileToBuffer(name);
  await db.dropFile(name);
  return buf;
}

/** Column names of a table (for autocomplete). */
export async function columnsOf(table: string): Promise<string[]> {
  const r = await query(`SELECT column_name FROM (DESCRIBE ${table})`);
  return r.rows.map((x) => String(x.column_name));
}
