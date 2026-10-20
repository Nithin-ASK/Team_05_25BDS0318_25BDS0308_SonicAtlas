export interface HistoryItem { sql: string; ts: number; ms: number; rows: number }
const KEY = 'sa-query-history';

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => x && typeof x.sql === 'string') : [];
  } catch {
    return [];
  }
}

export function pushHistory(item: HistoryItem): HistoryItem[] {
  const next = [item, ...loadHistory().filter((h) => h.sql !== item.sql)].slice(0, 30);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked: keep in memory only */ }
  return next;
}

export function clearHistory(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Last successful query (shared with the Data Profile page). */
const LAST = 'sa-last-sql';
export function setLastSql(sql: string) { try { sessionStorage.setItem(LAST, sql); } catch { /* ignore */ } }
export function getLastSql(): string | null { try { return sessionStorage.getItem(LAST); } catch { return null; } }
