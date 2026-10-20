import { describe, it, expect } from 'vitest';
import { incompleteBeta, logGamma, tTwoSidedP, fUpperP, normalCdf, welchTTest, oneWayAnova, mannWhitneyU, formatP } from '../../src/lib/pvalues';

// Reference values computed with SciPy 1.x (scipy.stats / scipy.special).
const A = [4, 5, 5, 6, 6, 6, 7, 8, 9, 14];
const B = [1, 2, 3, 3, 4, 5, 5, 6, 7, 8, 8];
const C = [10, 11, 12, 9, 13];

describe('special functions', () => {
  it('logGamma(5) = ln 24', () => expect(logGamma(5)).toBeCloseTo(Math.log(24), 10));
  it('logGamma(0.5) = ln sqrt(pi)', () => expect(logGamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 10));
  it('I_0.4(2.5, 3.5) = 0.486904', () => expect(incompleteBeta(0.4, 2.5, 3.5)).toBeCloseTo(0.4869041915, 8));
  it('I_x bounds', () => {
    expect(incompleteBeta(0, 2, 3)).toBe(0);
    expect(incompleteBeta(1, 2, 3)).toBe(1);
  });
  it('normal CDF', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6);
  });
});

describe('t distribution', () => {
  it('t = 2, df = 10 -> p = 0.073388', () => expect(tTwoSidedP(2, 10)).toBeCloseTo(0.0733880348, 8));
  it('t = 3.5, df = 4.3 (non-integer df) -> p = 0.022127', () => expect(tTwoSidedP(3.5, 4.3)).toBeCloseTo(0.0221270974, 8));
  it('t = 1.2, df = 200 -> p = 0.231559', () => expect(tTwoSidedP(1.2, 200)).toBeCloseTo(0.2315588690, 8));
  it('symmetry and t = 0', () => {
    expect(tTwoSidedP(-2, 10)).toBeCloseTo(tTwoSidedP(2, 10), 12);
    expect(tTwoSidedP(0, 7)).toBeCloseTo(1, 12);
  });
});

describe('F distribution', () => {
  it('F = 3, (2, 12) -> p = 0.087791', () => expect(fUpperP(3, 2, 12)).toBeCloseTo(0.0877914952, 8));
  it('F = 1.5, (3, 30) -> p = 0.234628', () => expect(fUpperP(1.5, 3, 30)).toBeCloseTo(0.2346279325, 8));
  it('huge F -> p ~ 0', () => expect(fUpperP(512.07, 7, 4855)).toBeLessThan(1e-200));
});

describe('tests', () => {
  it('Welch t-test matches scipy (t = 1.968511, df = 17.5569, p = 0.065005)', () => {
    const r = welchTTest(A, B);
    expect(r.t).toBeCloseTo(1.9685107175, 8);
    expect(r.df).toBeCloseTo(17.5568592583, 6);
    expect(r.p).toBeCloseTo(0.0650048500, 7);
  });
  it('one-way ANOVA matches scipy (F = 11.145179, p = 0.000413)', () => {
    const r = oneWayAnova([A, B, C]);
    expect(r.F).toBeCloseTo(11.1451785892, 7);
    expect(r.p).toBeCloseTo(0.000412861169, 9);
    expect(r.df1).toBe(2);
    expect(r.df2).toBe(23);
    expect(r.eta2).toBeGreaterThan(0);
    expect(r.eta2).toBeLessThan(1);
  });
  it('Mann-Whitney U matches scipy asymptotic with continuity (U = 79.5, p = 0.088187)', () => {
    const r = mannWhitneyU(A, B);
    expect(r.U).toBe(79.5);
    expect(r.p).toBeCloseTo(0.0881865939, 6);
  });
  it('formatP', () => {
    expect(formatP(0)).toBe('< 1e-300');
    expect(formatP(0.0123)).toBe('0.0123');
    expect(formatP(0.00001234)).toBe('1.23e-5');
  });
});
