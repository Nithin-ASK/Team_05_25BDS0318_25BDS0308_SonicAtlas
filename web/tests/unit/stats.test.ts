import { describe as d, it, expect } from 'vitest';
import { mean, median, variance, std, tukeyQuartiles, skewnessG1, kurtosisG2, describe, boxStats, pearson, histogram } from '../../src/lib/stats';

const DATA = [4, 5, 5, 6, 6, 6, 7, 8, 9, 14];

d('descriptive statistics (course tutorial data)', () => {
  it('mean = 7', () => expect(mean(DATA)).toBeCloseTo(7, 10));
  it('median = 6', () => expect(median(DATA)).toBe(6));
  it('sample variance = 8.2222 (n-1)', () => expect(variance(DATA)).toBeCloseTo(8.2222, 4));
  it('std = sqrt(variance)', () => expect(std(DATA)).toBeCloseTo(Math.sqrt(74 / 9), 10));
  it('Tukey Q1 = 5, Q3 = 8, IQR = 3', () => {
    const q = tukeyQuartiles(DATA);
    expect(q.q1).toBe(5);
    expect(q.q3).toBe(8);
    expect(q.iqr).toBe(3);
  });
  it('G1 = 1.8026', () => expect(skewnessG1(DATA)).toBeCloseTo(1.8026, 4));
  it('G2 = 3.8414', () => expect(kurtosisG2(DATA)).toBeCloseTo(3.8414, 4));
  it('describe() bundles everything and ignores nulls', () => {
    const r = describe([...DATA, null, NaN, undefined]);
    expect(r.n).toBe(10);
    expect(r.mean).toBeCloseTo(7);
    expect(r.median).toBe(6);
    expect(r.q1).toBe(5);
    expect(r.q3).toBe(8);
    expect(r.min).toBe(4);
    expect(r.max).toBe(14);
  });
});

d('Tukey quartiles for odd n include the median in both halves', () => {
  it('1..7 -> Q1 = 2.5, Q3 = 5.5', () => {
    const q = tukeyQuartiles([7, 1, 3, 2, 6, 5, 4]);
    expect(q.median).toBe(4);
    expect(q.q1).toBe(2.5);
    expect(q.q3).toBe(5.5);
  });
  it('1..5 -> Q1 = 2, Q3 = 4', () => {
    const q = tukeyQuartiles([1, 2, 3, 4, 5]);
    expect(q.q1).toBe(2);
    expect(q.q3).toBe(4);
  });
  it('single value', () => expect(tukeyQuartiles([3]).iqr).toBe(0));
});

d('other helpers', () => {
  it('boxStats whiskers stop at 1.5 IQR (14 is an outlier)', () => {
    expect(boxStats(DATA)).toEqual([4, 5, 6, 8, 9]);
  });
  it('pearson of a perfect line is 1', () => expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1));
  it('histogram counts sum to n', () => {
    const h = histogram(DATA, 5);
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(10);
    expect(h.edges.length).toBe(6);
  });
  it('G1 is undefined for n < 3 and G2 for n < 4', () => {
    expect(Number.isNaN(skewnessG1([1, 2]))).toBe(true);
    expect(Number.isNaN(kurtosisG2([1, 2, 3]))).toBe(true);
  });
});
