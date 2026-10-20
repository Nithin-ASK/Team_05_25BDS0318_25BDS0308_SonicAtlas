import { clsx } from 'clsx';
import { useId, useState, useRef, useEffect, type ReactNode } from 'react';
import { AlertCircle, Database, Inbox, Check, ChevronDown, X } from 'lucide-react';

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('card', className)} {...rest}>{children}</div>;
}

export function CardHeader({ title, subtitle, actions, as = 'h2' }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; as?: 'h2' | 'h3' }) {
  const H = as;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-3.5">
      <div className="min-w-0">
        <H className="text-sm font-semibold text-fg">{title}</H>
        {subtitle && <p className="mt-0.5 text-xs text-subtle">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, kicker, children, actions }: { title: string; kicker?: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {kicker && <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent">{kicker}</p>}
        <h1 className="h1">{title}</h1>
        {children && <div className="lead mt-2">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-subtle">{hint}</div>}
    </div>
  );
}

export function Skeleton({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return <div className={clsx('skeleton rounded-lg', className)} role="status" aria-label={label} />;
}

export function EmptyState({ title, children, icon = 'inbox', action }: { title: string; children?: ReactNode; icon?: 'inbox' | 'data' | 'error'; action?: ReactNode }) {
  const I = icon === 'data' ? Database : icon === 'error' ? AlertCircle : Inbox;
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center" role="status">
      <I className="h-8 w-8 text-subtle" aria-hidden />
      <p className="text-sm font-semibold text-fg">{title}</p>
      {children && <div className="max-w-md text-sm text-subtle">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function DataMissing({ file }: { file: string }) {
  return (
    <EmptyState title="Data not available yet" icon="data">
      <p><code className="kbd">{file}</code> has not been exported to <code className="kbd">web/public/data/</code>. Run{' '}
        <code className="kbd">python -m sonicatlas.web_export</code> and reload.</p>
    </EmptyState>
  );
}

export function Field({ label, children, htmlFor, hint }: { label: ReactNode; children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

export function Select({ label, value, onChange, options, id, className }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; id?: string; className?: string;
}) {
  const auto = useId();
  const sid = id ?? auto;
  return (
    <div className={className}>
      <label className="label" htmlFor={sid}>{label}</label>
      <select id={sid} className="input pr-8" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/** Segmented control (radio group). */
export function Segmented<T extends string>({ label, value, onChange, options, hideLabel }: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <div id={id} className={clsx('label', hideLabel && 'sr-only')}>{label}</div>
      <div role="radiogroup" aria-labelledby={id} className="inline-flex flex-wrap rounded-lg border border-border bg-muted p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={clsx('rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-subtle hover:text-fg')}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Dual-thumb range slider built from two native range inputs (keyboard accessible). */
export function RangeSlider({ label, min, max, step, value, onChange, format = (v) => String(v) }: {
  label: string; min: number; max: number; step: number; value: [number, number]; onChange: (v: [number, number]) => void; format?: (v: number) => string;
}) {
  const id = useId();
  const [lo, hi] = value;
  const span = max - min || 1;
  const active = lo > min || hi < max;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span id={id} className={clsx('text-xs font-medium', active ? 'text-accent' : 'text-subtle')}>{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-subtle">{format(lo)} - {format(hi)}</span>
      </div>
      <div className="range-dual">
        <div className="track" />
        <div className="fill" style={{ left: `${((lo - min) / span) * 100}%`, right: `${100 - ((hi - min) / span) * 100}%` }} />
        <input type="range" aria-label={`${label} minimum`} aria-valuetext={format(lo)} min={min} max={max} step={step} value={lo}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])} />
        <input type="range" aria-label={`${label} maximum`} aria-valuetext={format(hi)} min={min} max={max} step={step} value={hi}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])} />
      </div>
    </div>
  );
}

/** Searchable multi-select with checkboxes. */
export function MultiSelect({ label, options, value, onChange, placeholder = 'Search...', max }: {
  label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase())).slice(0, 200);
  const toggle = (o: string) => {
    if (value.includes(o)) onChange(value.filter((x) => x !== o));
    else if (!max || value.length < max) onChange([...value, o]);
  };
  return (
    <div ref={ref} className="relative" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <span className="label" id={id}>{label}</span>
      <button type="button" className="input flex min-h-[38px] items-center justify-between gap-2 text-left" aria-haspopup="listbox" aria-expanded={open}
        aria-labelledby={id} onClick={() => setOpen((o) => !o)}>
        <span className={clsx('truncate', !value.length && 'text-subtle')}>{value.length ? value.join(', ') : 'Any'}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
      </button>
      {value.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {value.map((v) => (
            <button key={v} type="button" className="chip hover:bg-border" onClick={() => toggle(v)} aria-label={`Remove ${v}`}>
              {v} <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[220px] rounded-lg border border-border bg-surface p-2 shadow-lg">
          <input autoFocus className="input mb-2" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${label}`} />
          <ul role="listbox" aria-multiselectable="true" aria-label={label} className="scrollbar-thin max-h-60 overflow-auto">
            {filtered.map((o) => {
              const sel = value.includes(o);
              return (
                <li key={o} role="option" aria-selected={sel}>
                  <button type="button" onClick={() => toggle(o)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className={clsx('flex h-4 w-4 items-center justify-center rounded border', sel ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
                      {sel && <Check className="h-3 w-3" aria-hidden />}
                    </span>
                    {o}
                  </button>
                </li>
              );
            })}
            {!filtered.length && <li className="px-2 py-1.5 text-sm text-subtle">No matches</li>}
          </ul>
          {max && <p className="mt-1 px-1 text-[11px] text-subtle">Up to {max}.</p>}
        </div>
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-hidden />;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'error' }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'note'} className={clsx('rounded-lg border px-3 py-2 text-sm',
      tone === 'error' ? 'border-danger/40 bg-danger/10 text-fg' : tone === 'warn' ? 'border-[#E69F00]/50 bg-[#E69F00]/10 text-fg' : 'border-accent/30 bg-accent/5 text-fg')}>
      {children}
    </div>
  );
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('en-US');
}

export function fmtNum(n: number | null | undefined, d = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-';
  return n.toFixed(d);
}
