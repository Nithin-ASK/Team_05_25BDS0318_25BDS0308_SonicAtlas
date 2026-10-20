import { describe, it, expect } from 'vitest';
import { andrewsCurve, tGrid } from '../../src/lib/andrews';
import { cosine, scale, similaritySql } from '../../src/lib/similarity';

describe('Andrews curves', () => {
  it('f(0) = x1/sqrt2 + x3 + x5 (sines vanish)', () => {
    const [y] = andrewsCurve([1, 2, 3, 4, 5], [0]);
    expect(y).toBeCloseTo(1 / Math.SQRT2 + 3 + 5, 10);
  });
  it('f(pi/2) = x1/sqrt2 + x2 - x5', () => {
    const [y] = andrewsCurve([1, 2, 3, 4, 5], [Math.PI / 2]);
    expect(y).toBeCloseTo(1 / Math.SQRT2 + 2 - 5, 10);
  });
  it('t grid spans [-pi, pi]', () => {
    const g = tGrid(5);
    expect(g[0]).toBeCloseTo(-Math.PI);
    expect(g[4]).toBeCloseTo(Math.PI);
  });
});

describe('similarity', () => {
  it('cosine of identical vectors is 1 and of orthogonal vectors is 0', () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBe(0);
  });
  it('min-max scale clamps to [0, 1]', () => {
    expect(scale(5, [0, 10])).toBe(0.5);
    expect(scale(-1, [0, 10])).toBe(0);
    expect(scale(11, [0, 10])).toBe(1);
  });
  it('similarity SQL excludes the target id and orders by similarity', () => {
    const b: Record<string, [number, number]> = {};
    const t: Record<string, number> = {};
    for (const f of ['danceability', 'energy', 'loudness', 'speechiness', 'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo']) { b[f] = [0, 1]; t[f] = 0.5; }
    const sql = similaritySql(t, b, { excludeId: "a'b", limit: 5 });
    expect(sql).toContain("id <> 'a''b'");
    expect(sql).toContain('ORDER BY similarity DESC');
    expect(sql).toContain('LIMIT 5');
  });
});
