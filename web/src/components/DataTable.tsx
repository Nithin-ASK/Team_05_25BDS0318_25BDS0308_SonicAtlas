import { useMemo, useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

function cell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(3);
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function DataTable({ columns, rows, pageSize = 25, caption, onRowClick, rowLabel }: {
  columns: string[]; rows: Record<string, unknown>[]; pageSize?: number; caption: string;
  onRowClick?: (r: Record<string, unknown>) => void; rowLabel?: (r: Record<string, unknown>) => string;
}) {
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [rows]);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { col, dir } = sort;
    return [...rows].sort((a, b) => {
      const x = a[col], y = b[col];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const view = sorted.slice(page * pageSize, page * pageSize + pageSize);
  const toggle = (c: string) => setSort((s) => (s?.col === c ? (s.dir === 1 ? { col: c, dir: -1 } : null) : { col: c, dir: 1 }));

  return (
    <div>
      <div className="scrollbar-thin overflow-auto rounded-lg border border-border" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" aria-sort={sort?.col === c ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                  className="border-b border-border px-3 py-2 text-left text-xs font-semibold text-subtle">
                  <button type="button" onClick={() => toggle(c)} className="inline-flex items-center gap-1 hover:text-fg">
                    {c}
                    {sort?.col === c && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={i} className={clsx('border-b border-border/60 last:border-0 hover:bg-muted/60', onRowClick && 'cursor-pointer')}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(r); } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick && rowLabel ? rowLabel(r) : undefined}>
                {columns.map((c) => {
                  const v = r[c];
                  return (
                    <td key={c} className={clsx('max-w-[280px] truncate px-3 py-1.5', typeof v === 'number' && 'text-right font-mono text-xs tabular-nums')} title={typeof v === 'string' ? v : undefined}>
                      {cell(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-subtle">
        <span>{rows.length.toLocaleString('en-US')} rows{sort ? ` - sorted by ${sort.col} ${sort.dir === 1 ? 'ascending' : 'descending'}` : ''}</span>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span aria-live="polite">Page {page + 1} of {pages}</span>
          <button type="button" className="btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
