import { PROFILE_FEATURES } from './features';
import { quoteString } from './sqlBuilder';

export type Bounds = Record<string, [number, number]>;

export function boundsSql(table = 'tracks'): string {
  return `SELECT ${PROFILE_FEATURES.map((f) => `MIN(${f})::DOUBLE AS ${f}_min, MAX(${f})::DOUBLE AS ${f}_max`).join(', ')} FROM ${table}`;
}

export function parseBounds(row: Record<string, unknown>): Bounds {
  const b: Bounds = {};
  for (const f of PROFILE_FEATURES) b[f] = [Number(row[`${f}_min`]), Number(row[`${f}_max`])];
  return b;
}

export function scale(v: number, [lo, hi]: [number, number]): number {
  return hi > lo ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : 0;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Nearest neighbours by cosine similarity on min-max scaled features, computed in DuckDB.
 * target: raw feature values (unscaled).
 */
export function similaritySql(target: Record<string, number>, bounds: Bounds, opts: { excludeId?: string; limit?: number; table?: string; where?: string } = {}): string {
  const t = PROFILE_FEATURES.map((f) => scale(target[f], bounds[f]));
  const tn = Math.sqrt(t.reduce((s, x) => s + x * x, 0)) || 1;
  const scaled = PROFILE_FEATURES.map((f) => {
    const [lo, hi] = bounds[f];
    const den = hi - lo || 1;
    return `((${f} - ${lo}) / ${den})`;
  });
  const dot = scaled.map((s, i) => `${s} * ${t[i]}`).join(' + ');
  const norm = `SQRT(${scaled.map((s) => `${s} * ${s}`).join(' + ')})`;
  const where: string[] = [];
  if (opts.excludeId) where.push(`id <> ${quoteString(opts.excludeId)}`);
  if (opts.where) where.push(opts.where);
  return `SELECT id, name, artist, year, genre, ${PROFILE_FEATURES.join(', ')},
  (${dot}) / (NULLIF(${norm}, 0) * ${tn}) AS similarity
FROM ${opts.table ?? 'tracks'}${where.length ? '\nWHERE ' + where.join(' AND ') : ''}
ORDER BY similarity DESC
LIMIT ${opts.limit ?? 20}`;
}
