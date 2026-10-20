import { useEffect, useState } from 'react';
import { DATA_BASE, DATA_FILES } from '../config';

const cache = new Map<string, Promise<unknown | null>>();

/** Fetch a JSON file from public/data. Resolves null when missing or invalid (e.g. SPA fallback HTML). */
export function fetchJSON<T = any>(file: string): Promise<T | null> {
  if (!cache.has(file)) {
    cache.set(
      file,
      fetch(new URL(DATA_BASE + file, document.baseURI).href)
        .then(async (r) => {
          if (!r.ok) return null;
          const text = await r.text();
          if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) return null;
          return JSON.parse(text.replace(/\bNaN\b/g, 'null').replace(/-?\bInfinity\b/g, 'null'));
        })
        .catch(() => null),
    );
  }
  return cache.get(file) as Promise<T | null>;
}

export type Loadable<T> = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; data: T };

export function useJSON<T = any>(file: string): Loadable<T> {
  const [s, setS] = useState<Loadable<T>>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    fetchJSON<T>(file).then((d) => { if (alive) setS(d ? { status: 'ready', data: d } : { status: 'missing' }); });
    return () => { alive = false; };
  }, [file]);
  return s;
}

export const useSummary = () => useJSON<Summary>(DATA_FILES.summary);

/** Safe deep getter: get(obj, 'a.b.c'). */
export function get<T = any>(obj: any, path: string, fallback?: T): T {
  let cur = obj;
  for (const k of path.split('.')) {
    if (cur === null || cur === undefined) return fallback as T;
    cur = cur[k];
  }
  return (cur === undefined || cur === null ? fallback : cur) as T;
}

export interface ClusterInfo { name: string; size: number; share_pct: number; top_genres: string; [f: string]: number | string }

export interface Summary {
  audit?: Record<string, any>;
  cleaning?: Record<string, any>;
  descriptive?: Record<string, any>;
  multivariate?: Record<string, any>;
  dimred?: { clusters?: Record<string, ClusterInfo>; comparison?: Record<string, Record<string, number>>; [k: string]: any };
  timeseries?: Record<string, any>;
  tests?: Record<string, any>;
  lyrics?: Record<string, any>;
  network?: Record<string, any>;
  profiling?: Record<string, any>;
}

export function clusterNames(s: Summary | null | undefined): Record<number, string> {
  const out: Record<number, string> = {};
  const c = s?.dimred?.clusters;
  if (c) for (const [k, v] of Object.entries(c)) out[Number(k)] = v?.name ?? `Cluster ${k}`;
  return out;
}

export function clusterLabel(names: Record<number, string>, k: number | null | undefined): string {
  if (k === null || k === undefined) return 'n/a';
  return names[k] ? `${k}: ${names[k]}` : `Cluster ${k}`;
}
