/**
 * Distribution functions and hypothesis tests implemented from scratch.
 * The t and F tail probabilities use the regularized incomplete beta function,
 * evaluated with Lentz's continued fraction (Numerical Recipes, 3rd ed., section 6.4).
 */
import { mean, variance } from './stats';

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** Natural log of the gamma function (Lanczos approximation, g = 7). */
export function logGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i++) x += LANCZOS[i] / (z + i + 1);
  const t = z + LANCZOS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 1000, EPS = 1e-15, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lbt);
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value for Student's t with df degrees of freedom. */
export function tTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t) || !(df > 0)) return NaN;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** Student t CDF. */
export function tCdf(t: number, df: number): number {
  const p = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - p : p;
}

/** Upper-tail p-value P(F > f) for the F distribution with (d1, d2) degrees of freedom. */
export function fUpperP(f: number, d1: number, d2: number): number {
  if (!Number.isFinite(f) || f < 0) return NaN;
  return incompleteBeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
}

/** Complementary error function (Numerical Recipes erfcc, fractional error < 1.2e-7). */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

export function normalTwoSidedP(z: number): number {
  return erfc(Math.abs(z) / Math.SQRT2);
}

export interface WelchResult { t: number; df: number; p: number; d: number; meanA: number; meanB: number; nA: number; nB: number }

/** Welch's unequal-variance t-test with Cohen's d (pooled SD). */
export function welchTTest(a: ArrayLike<number>, b: ArrayLike<number>): WelchResult {
  const nA = a.length, nB = b.length;
  const mA = mean(a), mB = mean(b), vA = variance(a), vB = variance(b);
  const se2 = vA / nA + vB / nB;
  const t = (mA - mB) / Math.sqrt(se2);
  const df = (se2 * se2) / ((vA / nA) ** 2 / (nA - 1) + (vB / nB) ** 2 / (nB - 1));
  const sp = Math.sqrt(((nA - 1) * vA + (nB - 1) * vB) / (nA + nB - 2));
  return { t, df, p: tTwoSidedP(t, df), d: (mA - mB) / sp, meanA: mA, meanB: mB, nA, nB };
}

export interface AnovaResult { F: number; df1: number; df2: number; p: number; eta2: number; ssb: number; ssw: number }

/** One-way ANOVA with eta squared = SSB / SST. */
export function oneWayAnova(groups: ArrayLike<number>[]): AnovaResult {
  const k = groups.length;
  let N = 0, total = 0;
  for (const g of groups) { N += g.length; for (let i = 0; i < g.length; i++) total += g[i]; }
  const grand = total / N;
  let ssb = 0, ssw = 0;
  for (const g of groups) {
    const m = mean(g);
    ssb += g.length * (m - grand) ** 2;
    for (let i = 0; i < g.length; i++) ssw += (g[i] - m) ** 2;
  }
  const df1 = k - 1, df2 = N - k;
  const F = ssb / df1 / (ssw / df2);
  return { F, df1, df2, p: fUpperP(F, df1, df2), eta2: ssb / (ssb + ssw), ssb, ssw };
}

export interface MannWhitneyResult { U: number; z: number; p: number; r: number; rankBiserial: number }

/**
 * Mann-Whitney U (U of the first sample) with average ranks for ties,
 * tie-corrected normal approximation and a 0.5 continuity correction.
 */
export function mannWhitneyU(a: ArrayLike<number>, b: ArrayLike<number>): MannWhitneyResult {
  const n1 = a.length, n2 = b.length, N = n1 + n2;
  const vals = new Float64Array(N);
  const grp = new Uint8Array(N);
  for (let i = 0; i < n1; i++) vals[i] = a[i];
  for (let i = 0; i < n2; i++) { vals[n1 + i] = b[i]; grp[n1 + i] = 1; }
  const idx = Array.from({ length: N }, (_, i) => i).sort((x, y) => vals[x] - vals[y]);
  let r1 = 0, tieSum = 0;
  for (let i = 0; i < N;) {
    let j = i;
    while (j + 1 < N && vals[idx[j + 1]] === vals[idx[i]]) j++;
    const rank = (i + j) / 2 + 1;
    const t = j - i + 1;
    if (t > 1) tieSum += t * t * t - t;
    for (let k = i; k <= j; k++) if (grp[idx[k]] === 0) r1 += rank;
    i = j + 1;
  }
  const U = r1 - (n1 * (n1 + 1)) / 2;
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tieSum / (N * (N - 1))));
  const diff = U - mu;
  const z = sigma > 0 ? (diff - Math.sign(diff) * 0.5) / sigma : 0;
  return { U, z, p: normalTwoSidedP(z), r: Math.abs(z) / Math.sqrt(N), rankBiserial: (2 * U) / (n1 * n2) - 1 };
}

export function formatP(p: number): string {
  if (!Number.isFinite(p)) return 'n/a';
  if (p === 0 || p < 1e-300) return '< 1e-300';
  if (p < 0.001) return p.toExponential(2);
  return p.toFixed(4);
}

/** Plain-language label for effect sizes (Cohen 1988 conventions). */
export function effectLabelD(d: number): string {
  const a = Math.abs(d);
  if (a < 0.2) return 'negligible';
  if (a < 0.5) return 'small';
  if (a < 0.8) return 'medium';
  return 'large';
}

export function effectLabelEta(eta2: number): string {
  if (eta2 < 0.01) return 'negligible';
  if (eta2 < 0.06) return 'small';
  if (eta2 < 0.14) return 'medium';
  return 'large';
}
