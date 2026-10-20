import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState, Suspense } from 'react';
import { clsx } from 'clsx';
import {
  Home, TerminalSquare, Map, Users, GitCompare, Clock, Fingerprint, FileText, Share2, ClipboardList, BookOpen, Sun, Moon, Menu, X, Database,
} from 'lucide-react';
import { useTheme } from '../lib/theme';
import { useDbState, initMain, setSource } from '../lib/db';
import { Skeleton, Spinner } from './ui';
import { FULL_DATA_URL } from '../config';

export const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/query', label: 'Query Studio', icon: TerminalSquare },
  { to: '/map', label: 'Acoustic Map', icon: Map },
  { to: '/twins', label: 'Sonic Twins', icon: Users },
  { to: '/compare', label: 'Compare', icon: GitCompare },
  { to: '/time', label: 'Time Machine', icon: Clock },
  { to: '/genres', label: 'Genre Fingerprints', icon: Fingerprint },
  { to: '/lyrics', label: 'Lyrics Lab', icon: FileText },
  { to: '/network', label: 'Collaboration Network', icon: Share2 },
  { to: '/profile', label: 'Data Profile', icon: ClipboardList },
  { to: '/about', label: 'Methodology & About', icon: BookOpen },
];

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0072B2" />
      <g fill="#fff"><rect x="6" y="13" width="3" height="6" rx="1.5" /><rect x="11" y="9" width="3" height="14" rx="1.5" /><rect x="16" y="6" width="3" height="20" rx="1.5" /><rect x="21" y="11" width="3" height="10" rx="1.5" /></g>
      <circle cx="26" cy="7" r="3" fill="#E69F00" />
    </svg>
  );
}

function DbStatus() {
  const s = useDbState();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggleFull = async () => {
    setBusy(true); setErr(null);
    try { await setSource(s.source === 'full' ? 'lite' : 'full'); }
    catch (e: any) { setErr(`Full dataset unavailable (${FULL_DATA_URL}). ${e?.message ?? ''}`); }
    finally { setBusy(false); }
  };
  const label = s.phase === 'ready'
    ? `${(s.rows ?? 0).toLocaleString('en-US')} tracks (${s.source === 'full' ? 'full' : 'lite'})`
    : s.phase === 'error' ? 'Data unavailable' : s.phase === 'idle' ? 'SQL engine idle' : 'Loading data';
  return (
    <div className="flex items-center gap-2">
      <span className={clsx('chip', s.phase === 'error' && 'border-danger/50')} title={err ?? s.message} data-testid="db-status">
        {s.phase === 'ready' ? <Database className="h-3.5 w-3.5 text-ok" aria-hidden /> : s.phase === 'error' ? <Database className="h-3.5 w-3.5 text-danger" aria-hidden /> : <Spinner className="h-3 w-3" />}
        <span>{label}</span>
      </span>
      {s.phase === 'ready' && (
        <button type="button" className="btn-secondary btn-sm hidden md:inline-flex" onClick={toggleFull} disabled={busy} aria-pressed={s.source === 'full'}
          title={err ?? 'Switch the "tracks" table between the 150k sample and the full 1.2M-row file (fetched over HTTP range requests)'}>
          {busy ? <Spinner className="h-3 w-3" /> : null}
          {s.source === 'full' ? 'Use 150k sample' : 'Load full dataset'}
        </button>
      )}
      {err && <span className="sr-only" role="alert">{err}</span>}
    </div>
  );
}

function ProgressBar() {
  const s = useDbState();
  const show = s.phase === 'engine' || s.phase === 'data';
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1 bg-muted" role="progressbar" aria-label={s.message} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.progress * 100)}>
      <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(3, s.progress * 100)}%` }} />
    </div>
  );
}

export function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      <Skeleton className="h-80" />
    </div>
  );
}

export function Layout() {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { void initMain(); }, []);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const current = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));
  useEffect(() => { document.title = current && current.to !== '/' ? `${current.label} - SonicAtlas` : 'SonicAtlas - explore 150k Spotify tracks in your browser'; }, [current]);

  const nav = (
    <nav aria-label="Main">
      <ul className="space-y-0.5">
        {NAV.map((n) => (
          <li key={n.to}>
            <NavLink to={n.to} end={n.end}
              className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-accent/10 font-semibold text-accent' : 'text-subtle hover:bg-muted hover:text-fg')}>
              <n.icon className="h-4 w-4 shrink-0" aria-hidden />
              {n.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-full lg:flex">
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <ProgressBar />
      <div className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
      <aside className="sticky top-0 z-30 flex h-screen flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Logo />
          <div>
            <div className="text-base font-semibold leading-tight">SonicAtlas</div>
            <div className="text-[11px] text-subtle">Spotify audio EDA studio</div>
          </div>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3">{nav}</div>
        <div className="border-t border-border px-5 py-4 text-[11px] leading-relaxed text-subtle">
          Team 05 - VIT Vellore<br />BACSE301 Exploratory Data Analysis
        </div>
      </aside>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-surface p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Logo /><span className="font-semibold">SonicAtlas</span></div>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close navigation"><X className="h-5 w-5" aria-hidden /></button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}>
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <span className="text-sm font-medium text-subtle">{current?.label ?? 'SonicAtlas'}</span>
          </div>
          <div className="flex items-center gap-2">
            <DbStatus />
            <button type="button" className="btn-ghost" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} data-testid="theme-toggle">
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-[1400px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="border-t border-border px-4 py-6 text-center text-xs text-subtle sm:px-6">
          SonicAtlas - Team 05 (25BDS0318 Sharvesh Prabhu, 25BDS0308 Nithin S) - BACSE301 Exploratory Data Analysis, VIT Vellore. Code MIT licensed. All SQL runs locally in your browser.
        </footer>
      </div>
    </div>
  );
}
