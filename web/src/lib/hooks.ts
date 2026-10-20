import { useEffect, useState } from 'react';
import { ensureTable, query, queryColumns, useDbState, type QueryResult, type TableName } from './db';

export type TableStatus = 'loading' | 'ready' | 'missing';

/** Make sure a parquet-backed table is loaded; returns its status. */
export function useTable(name: TableName): TableStatus {
  const [s, setS] = useState<TableStatus>('loading');
  useEffect(() => {
    let alive = true;
    ensureTable(name).then((ok) => { if (alive) setS(ok ? 'ready' : 'missing'); });
    return () => { alive = false; };
  }, [name]);
  return s;
}

export type SqlState<T> = { status: 'idle' | 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T; ms: number };

/** Run a SQL query once the given tables are ready; re-runs when sql changes. */
export function useSql(sql: string | null, tables: TableName[] = ['tracks_lite']): SqlState<QueryResult> {
  const [s, setS] = useState<SqlState<QueryResult>>({ status: 'idle' });
  const db = useDbState();
  const key = tables.join(',');
  useEffect(() => {
    if (!sql) { setS({ status: 'idle' }); return; }
    let alive = true;
    setS({ status: 'loading' });
    Promise.all(tables.map(ensureTable))
      .then((ok) => {
        if (!ok.every(Boolean)) throw new Error('missing');
        return query(sql);
      })
      .then((r) => { if (alive) setS({ status: 'ready', data: r, ms: r.ms }); })
      .catch((e) => { if (alive) setS({ status: 'error', error: String(e?.message ?? e) }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, key, db.source]);
  return s;
}

/** Column-oriented variant for charts. */
export function useSqlColumns(sql: string | null, tables: TableName[] = ['tracks_lite']): SqlState<{ cols: Record<string, any[]>; n: number }> {
  const [s, setS] = useState<SqlState<{ cols: Record<string, any[]>; n: number }>>({ status: 'idle' });
  const db = useDbState();
  const key = tables.join(',');
  useEffect(() => {
    if (!sql) { setS({ status: 'idle' }); return; }
    let alive = true;
    setS({ status: 'loading' });
    Promise.all(tables.map(ensureTable))
      .then((ok) => {
        if (!ok.every(Boolean)) throw new Error('missing');
        return queryColumns(sql);
      })
      .then((r) => { if (alive) setS({ status: 'ready', data: r, ms: r.ms }); })
      .catch((e) => { if (alive) setS({ status: 'error', error: String(e?.message ?? e) }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, key, db.source]);
  return s;
}

/** Download helper. */
export function download(name: string, data: BlobPart, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
}

export function toCSV(columns: string[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n');
}
