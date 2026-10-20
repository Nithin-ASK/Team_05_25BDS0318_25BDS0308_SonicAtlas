import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
interface Ctx { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }
const ThemeCtx = createContext<Ctx>({ theme: 'light', toggle: () => {}, setTheme: () => {} });

function initial(): Theme {
  try {
    const saved = localStorage.getItem('sa-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage may be blocked */ }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initial);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0f17' : '#ffffff');
  }, [theme]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => {
      let saved: string | null = null;
      try { saved = localStorage.getItem('sa-theme'); } catch { /* ignore */ }
      if (!saved) setThemeState(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem('sa-theme', t); } catch { /* ignore */ }
  }, []);
  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);
  const v = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);
  return <ThemeCtx.Provider value={v}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
