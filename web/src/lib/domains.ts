import { useEffect, useState } from 'react';
import { AUDIO_FEATURES } from './features';
import { ensureTable, query } from './db';

export interface Domains {
  ranges: Record<string, [number, number]>;
  steps: Record<string, number>;
  genres: string[];
  keys: string[];
}

export function stepFor(f: string): number {
  if (f === 'tempo') return 1;
  if (f === 'loudness') return 0.5;
  if (f === 'duration_min') return 0.1;
  if (f === 'year') return 1;
  return 0.01;
}

let cached: Promise<Domains | null> | null = null;

/** Data-driven slider domains (min / max from the lite table, rounded outward to the step). */
export function loadDomains(): Promise<Domains | null> {
  if (!cached) {
    cached = (async () => {
      const ok = await ensureTable('tracks_lite');
      if (!ok) { cached = null; return null; }
      const cols = [...AUDIO_FEATURES, 'year'];
      const sel = cols.map((c) => `MIN(${c})::DOUBLE AS ${c}_min, MAX(${c})::DOUBLE AS ${c}_max`).join(', ');
      const r = await query(`SELECT ${sel} FROM tracks_lite`);
      const row = r.rows[0];
      const ranges: Record<string, [number, number]> = {};
      const steps: Record<string, number> = {};
      for (const c of cols) {
        const st = stepFor(c);
        const lo = Math.floor(Number(row[`${c}_min`]) / st) * st;
        const hi = Math.ceil(Number(row[`${c}_max`]) / st) * st;
        ranges[c] = [Number(lo.toFixed(4)), Number(hi.toFixed(4))];
        steps[c] = st;
      }
      const g = await query('SELECT DISTINCT genre FROM tracks_lite WHERE genre IS NOT NULL ORDER BY genre');
      const k = await query('SELECT DISTINCT key_name FROM tracks_lite WHERE key_name IS NOT NULL ORDER BY key_name');
      return { ranges, steps, genres: g.rows.map((x) => String(x.genre)), keys: k.rows.map((x) => String(x.key_name)) };
    })().catch(() => { cached = null; return null; });
  }
  return cached;
}

export function useDomains(): Domains | null {
  const [d, setD] = useState<Domains | null>(null);
  useEffect(() => { let a = true; loadDomains().then((x) => { if (a) setD(x); }); return () => { a = false; }; }, []);
  return d;
}

let genreCache: Promise<string[]> | null = null;
/** The 114 genres of the genre-labelled table. */
export function loadGenreList(): Promise<string[]> {
  if (!genreCache) {
    genreCache = ensureTable('genre_tracks').then(async (ok) => {
      if (!ok) { genreCache = null; return []; }
      const r = await query('SELECT genre, COUNT(*) AS n FROM genre_tracks GROUP BY genre ORDER BY genre');
      return r.rows.map((x) => String(x.genre));
    });
  }
  return genreCache;
}

export function useGenreList(): string[] | null {
  const [g, setG] = useState<string[] | null>(null);
  useEffect(() => { let a = true; loadGenreList().then((x) => { if (a) setG(x); }); return () => { a = false; }; }, []);
  return g;
}
