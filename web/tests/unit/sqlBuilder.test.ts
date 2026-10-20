import { describe, it, expect } from 'vitest';
import { buildSql, whereClauses, DEFAULT_FILTER, toPandas, encodeFilter, decodeFilter, quoteString, activeFilterCount, type FilterState } from '../../src/lib/sqlBuilder';

const f = (o: Partial<FilterState>): FilterState => ({ ...DEFAULT_FILTER, ranges: {}, ...o });

describe('SQL filter builder', () => {
  it('default filter has no WHERE and a LIMIT', () => {
    expect(buildSql(f({}))).toBe('SELECT *\nFROM tracks\nLIMIT 500');
  });
  it('feature ranges become BETWEEN clauses in a fixed order', () => {
    const w = whereClauses(f({ ranges: { valence: [0.2, 0.8], energy: [0.5, 1] } }));
    expect(w).toEqual(['energy BETWEEN 0.5 AND 1', 'valence BETWEEN 0.2 AND 0.8']);
  });
  it('year, genres, explicit, outliers', () => {
    const sql = buildSql(f({ year: [1980, 1989], genres: ['rock', 'jazz'], explicit: 'no', outliers: 'exclude' }));
    expect(sql).toContain('year BETWEEN 1980 AND 1989');
    expect(sql).toContain("genre IN ('rock', 'jazz')");
    expect(sql).toContain('NOT explicit');
    expect(sql).toContain('NOT is_outlier');
  });
  it('keys combine with mode', () => {
    expect(whereClauses(f({ keys: ['C#'], mode: 'minor' }))).toEqual(["key_name IN ('C# minor')"]);
    expect(whereClauses(f({ keys: ['D'] }))).toEqual(["key_name IN ('D major', 'D minor')"]);
    expect(whereClauses(f({ mode: 'major' }))).toEqual(["mode_name = 'major'"]);
  });
  it('artist search escapes quotes and LIKE wildcards', () => {
    const w = whereClauses(f({ artist: "Guns N' Roses 100%" }));
    expect(w[0]).toBe("artist ILIKE '%Guns N'' Roses 100\\%%' ESCAPE '\\'");
  });
  it('quoteString doubles single quotes (SQL injection safe)', () => {
    expect(quoteString("x'); DROP TABLE tracks; --")).toBe("'x''); DROP TABLE tracks; --'");
  });
  it('order by + limit, unsafe column names are ignored', () => {
    expect(buildSql(f({ orderBy: 'energy', orderDir: 'asc', limit: 10 }))).toContain('ORDER BY energy ASC\nLIMIT 10');
    expect(buildSql(f({ orderBy: 'energy; drop' }))).not.toContain('ORDER BY');
  });
  it('limit is clamped', () => {
    expect(buildSql(f({ limit: 10_000_000 }))).toContain('LIMIT 100000');
  });
  it('pandas export mirrors the filter', () => {
    const code = toPandas(f({ ranges: { energy: [0.7, 1] }, explicit: 'yes', orderBy: 'tempo' }));
    expect(code).toContain('df["energy"].between(0.7, 1)');
    expect(code).toContain('df["explicit"]');
    expect(code).toContain('sort_values("tempo", ascending=False)');
  });
  it('URL encode / decode round-trips', () => {
    const s = f({ ranges: { tempo: [100, 140] }, year: [1990, 1999], genres: ['pop'], keys: ['A'], mode: 'minor', explicit: 'yes', artist: 'abba', outliers: 'only', orderBy: 'energy', orderDir: 'asc', limit: 50 });
    expect(decodeFilter(encodeFilter(s))).toEqual(s);
    expect(activeFilterCount(s)).toBe(8);
  });
  it('decode tolerates garbage', () => {
    expect(decodeFilter('{not json')).toEqual({ ...DEFAULT_FILTER, ranges: {} });
    expect(decodeFilter(JSON.stringify({ r: { 'x;drop': [0, 1] } })).ranges).toEqual({});
  });
});
