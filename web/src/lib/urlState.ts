import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keep a piece of page state in the URL query string (inside the hash route),
 * so every view is shareable: #/compare?by=genre&g=["rock","jazz"]
 */
export function useUrlState<T>(key: string, def: T): [T, (v: T | ((p: T) => T)) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  // Memoised on the raw string so object values keep a stable identity between renders
  const value = useMemo<T>(() => {
    if (raw === null) return def;
    if (typeof def === 'string') return raw as unknown as T;
    try { return JSON.parse(raw) as T; } catch { return def; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
  const setValue = useCallback(
    (v: T | ((p: T) => T)) => {
      setParams(
        (prev) => {
          const cur = prev.get(key);
          let curVal: T = def;
          if (cur !== null) {
            if (typeof def === 'string') curVal = cur as unknown as T;
            else { try { curVal = JSON.parse(cur) as T; } catch { curVal = def; } }
          }
          const next = typeof v === 'function' ? (v as (p: T) => T)(curVal) : v;
          const n = new URLSearchParams(prev);
          const ser = typeof next === 'string' ? (next as string) : JSON.stringify(next);
          const defSer = typeof def === 'string' ? (def as unknown as string) : JSON.stringify(def);
          if (ser === defSer || ser === '' || ser === undefined) n.delete(key);
          else n.set(key, ser);
          return n;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, setParams],
  );
  return [value, setValue];
}
