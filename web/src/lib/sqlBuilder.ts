import { AUDIO_FEATURES } from './features';

export type TriState = 'any' | 'yes' | 'no';

export interface FilterState {
  /** Only features the user moved away from the full data range are present. */
  ranges: Partial<Record<string, [number, number]>>;
  year?: [number, number] | null;
  genres: string[];
  keys: string[]; // key letters, e.g. "C#"
  mode: 'any' | 'major' | 'minor';
  explicit: TriState;
  artist: string;
  outliers: 'include' | 'exclude' | 'only';
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  limit: number;
}

export const DEFAULT_FILTER: FilterState = {
  ranges: {},
  year: null,
  genres: [],
  keys: [],
  mode: 'any',
  explicit: 'any',
  artist: '',
  outliers: 'include',
  orderBy: undefined,
  orderDir: 'desc',
  limit: 500,
};

const SAFE_COLUMN = /^[a-z_][a-z0-9_]*$/;

export function quoteString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/** Escape LIKE wildcards so artist search is literal. */
export function likeEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function num(v: number): string {
  if (!Number.isFinite(v)) throw new Error('Non-finite number in filter');
  return String(Math.round(v * 1e6) / 1e6);
}

export function whereClauses(f: FilterState): string[] {
  const w: string[] = [];
  for (const feat of AUDIO_FEATURES) {
    const r = f.ranges[feat];
    if (r) w.push(`${feat} BETWEEN ${num(r[0])} AND ${num(r[1])}`);
  }
  for (const [k, r] of Object.entries(f.ranges)) {
    if (!r || (AUDIO_FEATURES as readonly string[]).includes(k)) continue;
    if (!SAFE_COLUMN.test(k)) continue;
    w.push(`${k} BETWEEN ${num(r[0])} AND ${num(r[1])}`);
  }
  if (f.year) w.push(`year BETWEEN ${Math.round(f.year[0])} AND ${Math.round(f.year[1])}`);
  if (f.genres.length) w.push(`genre IN (${f.genres.map(quoteString).join(', ')})`);
  const modes = f.mode === 'any' ? null : f.mode;
  if (f.keys.length) {
    const names = f.keys.flatMap((k) => (modes ? [`${k} ${modes}`] : [`${k} major`, `${k} minor`]));
    w.push(`key_name IN (${names.map(quoteString).join(', ')})`);
  } else if (modes) {
    w.push(`mode_name = ${quoteString(modes)}`);
  }
  if (f.explicit === 'yes') w.push('explicit');
  if (f.explicit === 'no') w.push('NOT explicit');
  const a = f.artist.trim();
  if (a) w.push(`artist ILIKE ${quoteString('%' + likeEscape(a) + '%')} ESCAPE '\\'`);
  if (f.outliers === 'exclude') w.push('NOT is_outlier');
  if (f.outliers === 'only') w.push('is_outlier');
  return w;
}

export function buildSql(f: FilterState, table = 'tracks', columns = '*'): string {
  const w = whereClauses(f);
  let sql = `SELECT ${columns}\nFROM ${table}`;
  if (w.length) sql += `\nWHERE ${w.join('\n  AND ')}`;
  if (f.orderBy && SAFE_COLUMN.test(f.orderBy)) sql += `\nORDER BY ${f.orderBy} ${f.orderDir === 'asc' ? 'ASC' : 'DESC'}`;
  const limit = Math.max(1, Math.min(100000, Math.round(f.limit || 500)));
  sql += `\nLIMIT ${limit}`;
  return sql;
}

/** Equivalent pandas code for the same filter. */
export function toPandas(f: FilterState, path = 'tracks_lite.parquet'): string {
  const c: string[] = [];
  for (const [k, r] of Object.entries(f.ranges)) {
    if (r && SAFE_COLUMN.test(k)) c.push(`df["${k}"].between(${num(r[0])}, ${num(r[1])})`);
  }
  if (f.year) c.push(`df["year"].between(${Math.round(f.year[0])}, ${Math.round(f.year[1])})`);
  if (f.genres.length) c.push(`df["genre"].isin([${f.genres.map((g) => JSON.stringify(g)).join(', ')}])`);
  const modes = f.mode === 'any' ? null : f.mode;
  if (f.keys.length) {
    const names = f.keys.flatMap((k) => (modes ? [`${k} ${modes}`] : [`${k} major`, `${k} minor`]));
    c.push(`df["key_name"].isin([${names.map((g) => JSON.stringify(g)).join(', ')}])`);
  } else if (modes) c.push(`(df["mode_name"] == "${modes}")`);
  if (f.explicit === 'yes') c.push('df["explicit"]');
  if (f.explicit === 'no') c.push('~df["explicit"]');
  if (f.artist.trim()) c.push(`df["artist"].str.contains(${JSON.stringify(f.artist.trim())}, case=False, regex=False, na=False)`);
  if (f.outliers === 'exclude') c.push('~df["is_outlier"]');
  if (f.outliers === 'only') c.push('df["is_outlier"]');
  let code = `import pandas as pd\n\ndf = pd.read_parquet("${path}")\n`;
  code += c.length ? `res = df[\n    ${c.map((x) => `(${x})`).join('\n    & ')}\n]\n` : 'res = df\n';
  if (f.orderBy && SAFE_COLUMN.test(f.orderBy)) code += `res = res.sort_values("${f.orderBy}", ascending=${f.orderDir === 'asc' ? 'True' : 'False'})\n`;
  code += `res = res.head(${Math.max(1, Math.round(f.limit || 500))})\n`;
  return code;
}

/** Wrap an arbitrary SELECT as pandas via duckdb (for the SQL console). */
export function sqlToPandas(sql: string): string {
  return `import duckdb\n\ncon = duckdb.connect()\ncon.execute("CREATE VIEW tracks AS SELECT * FROM 'tracks_lite.parquet'")\ndf = con.execute("""\n${sql.trim()}\n""").df()\n`;
}

/** Is this filter different from the default (used for the "active filters" badge)? */
export function activeFilterCount(f: FilterState): number {
  let n = Object.values(f.ranges).filter(Boolean).length;
  if (f.year) n++;
  if (f.genres.length) n++;
  if (f.keys.length) n++;
  if (f.mode !== 'any') n++;
  if (f.explicit !== 'any') n++;
  if (f.artist.trim()) n++;
  if (f.outliers !== 'include') n++;
  return n;
}

/** Serialize compactly into a URL-safe string. */
export function encodeFilter(f: FilterState): string {
  const o: Record<string, unknown> = {};
  if (Object.keys(f.ranges).length) o.r = f.ranges;
  if (f.year) o.y = f.year;
  if (f.genres.length) o.g = f.genres;
  if (f.keys.length) o.k = f.keys;
  if (f.mode !== 'any') o.m = f.mode;
  if (f.explicit !== 'any') o.e = f.explicit;
  if (f.artist) o.a = f.artist;
  if (f.outliers !== 'include') o.o = f.outliers;
  if (f.orderBy) o.s = [f.orderBy, f.orderDir ?? 'desc'];
  if (f.limit !== DEFAULT_FILTER.limit) o.l = f.limit;
  return JSON.stringify(o);
}

export function decodeFilter(s: string | null): FilterState {
  if (!s) return { ...DEFAULT_FILTER, ranges: {} };
  try {
    const o = JSON.parse(s) as Record<string, any>;
    const ranges: FilterState['ranges'] = {};
    if (o.r && typeof o.r === 'object') {
      for (const [k, v] of Object.entries(o.r)) {
        if (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number') && SAFE_COLUMN.test(k)) ranges[k] = [v[0], v[1]];
      }
    }
    return {
      ranges,
      year: Array.isArray(o.y) && o.y.length === 2 ? [Number(o.y[0]), Number(o.y[1])] : null,
      genres: Array.isArray(o.g) ? o.g.map(String) : [],
      keys: Array.isArray(o.k) ? o.k.map(String) : [],
      mode: o.m === 'major' || o.m === 'minor' ? o.m : 'any',
      explicit: o.e === 'yes' || o.e === 'no' ? o.e : 'any',
      artist: typeof o.a === 'string' ? o.a : '',
      outliers: o.o === 'exclude' || o.o === 'only' ? o.o : 'include',
      orderBy: Array.isArray(o.s) && SAFE_COLUMN.test(String(o.s[0])) ? String(o.s[0]) : undefined,
      orderDir: Array.isArray(o.s) && o.s[1] === 'asc' ? 'asc' : 'desc',
      limit: typeof o.l === 'number' ? o.l : DEFAULT_FILTER.limit,
    };
  } catch {
    return { ...DEFAULT_FILTER, ranges: {} };
  }
}
