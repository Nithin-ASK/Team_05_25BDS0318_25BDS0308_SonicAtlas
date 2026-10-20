/**
 * Descriptive statistics following the course conventions:
 *  - sample variance with n-1 denominator
 *  - Tukey quartiles (median of halves; for odd n the median belongs to both halves)
 *  - G1: adjusted Fisher-Pearson standardized moment coefficient of skewness
 *  - G2: bias-corrected sample excess kurtosis
 */

export function finite(xs: ArrayLike<number | null | undefined>): number[] {
  const out: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const v = xs[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) out.push(v as number);
  }
  return out;
}

export function sum(xs: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return s;
}

export function mean(xs: ArrayLike<number>): number {
  return xs.length ? sum(xs) / xs.length : NaN;
}

export function sortedCopy(xs: ArrayLike<number>): number[] {
  return Array.from(xs).sort((a, b) => a - b);
}

/** Median of an already sorted array slice [lo, hi). */
export function medianSorted(s: ArrayLike<number>, lo = 0, hi = s.length): number {
  const n = hi - lo;
  if (n <= 0) return NaN;
  const mid = lo + Math.floor(n / 2);
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function median(xs: ArrayLike<number>): number {
  return medianSorted(sortedCopy(xs));
}

/** Sample variance (n - 1 denominator). */
export function variance(xs: ArrayLike<number>): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = mean(xs);
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (xs[i] - m) ** 2;
  return ss / (n - 1);
}

export function std(xs: ArrayLike<number>): number {
  return Math.sqrt(variance(xs));
}

/** Tukey hinges: median of lower and upper halves; odd n includes the median in both halves. */
export function tukeyQuartiles(xs: ArrayLike<number>): { q1: number; median: number; q3: number; iqr: number } {
  const s = sortedCopy(xs);
  const n = s.length;
  if (n === 0) return { q1: NaN, median: NaN, q3: NaN, iqr: NaN };
  if (n === 1) return { q1: s[0], median: s[0], q3: s[0], iqr: 0 };
  const half = Math.floor(n / 2);
  const lowerEnd = n % 2 ? half + 1 : half; // exclusive end of the lower half
  const upperStart = half; // for odd n, s[half] is the median and belongs to both halves
  const q1 = medianSorted(s, 0, lowerEnd);
  const q3 = medianSorted(s, upperStart, n);
  return { q1, median: medianSorted(s), q3, iqr: q3 - q1 };
}

function centralMoments(xs: ArrayLike<number>) {
  const n = xs.length;
  const m = mean(xs);
  let m2 = 0, m3 = 0, m4 = 0;
  for (let i = 0; i < n; i++) {
    const d = xs[i] - m;
    const d2 = d * d;
    m2 += d2; m3 += d2 * d; m4 += d2 * d2;
  }
  return { n, m2: m2 / n, m3: m3 / n, m4: m4 / n };
}

/** Adjusted Fisher-Pearson skewness G1 = sqrt(n(n-1))/(n-2) * g1. */
export function skewnessG1(xs: ArrayLike<number>): number {
  const { n, m2, m3 } = centralMoments(xs);
  if (n < 3 || m2 === 0) return NaN;
  const g1 = m3 / Math.pow(m2, 1.5);
  return (Math.sqrt(n * (n - 1)) / (n - 2)) * g1;
}

/** Bias-corrected excess kurtosis G2 = (n-1)/((n-2)(n-3)) * ((n+1) g2 + 6). */
export function kurtosisG2(xs: ArrayLike<number>): number {
  const { n, m2, m4 } = centralMoments(xs);
  if (n < 4 || m2 === 0) return NaN;
  const g2 = m4 / (m2 * m2) - 3;
  return ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 + 6);
}

export interface Description {
  n: number; mean: number; median: number; std: number; variance: number;
  min: number; max: number; q1: number; q3: number; iqr: number; g1: number; g2: number;
}

export function describe(input: ArrayLike<number | null | undefined>): Description {
  const xs = finite(input);
  const s = sortedCopy(xs);
  const q = tukeyQuartiles(s);
  return {
    n: xs.length,
    mean: mean(xs),
    median: q.median,
    std: std(xs),
    variance: variance(xs),
    min: s.length ? s[0] : NaN,
    max: s.length ? s[s.length - 1] : NaN,
    q1: q.q1,
    q3: q.q3,
    iqr: q.iqr,
    g1: skewnessG1(xs),
    g2: kurtosisG2(xs),
  };
}

/** Five-number summary with Tukey whiskers (1.5 IQR) for boxplots. */
export function boxStats(input: ArrayLike<number>): [number, number, number, number, number] {
  const s = sortedCopy(finite(input));
  if (!s.length) return [NaN, NaN, NaN, NaN, NaN];
  const { q1, median: md, q3, iqr } = tukeyQuartiles(s);
  const loF = q1 - 1.5 * iqr, hiF = q3 + 1.5 * iqr;
  let lo = s[0], hi = s[s.length - 1];
  for (const v of s) { if (v >= loF) { lo = v; break; } }
  for (let i = s.length - 1; i >= 0; i--) { if (s[i] <= hiF) { hi = s[i]; break; } }
  return [lo, q1, md, q3, hi];
}

export function pearson(x: ArrayLike<number>, y: ArrayLike<number>): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Histogram with equal-width bins over [min, max]. */
export function histogram(input: ArrayLike<number | null | undefined>, bins = 30): { edges: number[]; counts: number[] } {
  const xs = finite(input);
  if (!xs.length) return { edges: [], counts: [] };
  let lo = Infinity, hi = -Infinity;
  for (const v of xs) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (lo === hi) hi = lo + 1;
  const w = (hi - lo) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of xs) counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++;
  const edges = Array.from({ length: bins + 1 }, (_, i) => lo + i * w);
  return { edges, counts };
}

/** Gaussian kernel density estimate on a grid (Silverman bandwidth), used for violin-like shapes. */
export function kde(input: ArrayLike<number>, points = 60): { x: number[]; y: number[] } {
  const xs = finite(input);
  const n = xs.length;
  if (n < 2) return { x: [], y: [] };
  const s = std(xs);
  const { iqr } = tukeyQuartiles(xs);
  const spread = Math.min(s, iqr / 1.34) || s || 1;
  const h = 0.9 * spread * Math.pow(n, -0.2);
  let lo = Infinity, hi = -Infinity;
  for (const v of xs) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const step = (hi - lo) / (points - 1 || 1);
  // subsample for speed
  const sample = n > 4000 ? xs.filter((_, i) => i % Math.ceil(n / 4000) === 0) : xs;
  const x: number[] = [], y: number[] = [];
  const c = 1 / (sample.length * h * Math.sqrt(2 * Math.PI));
  for (let i = 0; i < points; i++) {
    const g = lo + i * step;
    let acc = 0;
    for (const v of sample) { const u = (g - v) / h; acc += Math.exp(-0.5 * u * u); }
    x.push(g); y.push(acc * c);
  }
  return { x, y };
}
