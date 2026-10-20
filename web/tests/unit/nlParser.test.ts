import { describe, it, expect } from 'vitest';
import { parseQuery } from '../../src/lib/nlParser';

const GENRES = ['rock', 'jazz', 'hip-hop', 'deep-house', 'house', 'k-pop', 'classical', 'metal'];
const where = (q: string) => parseQuery(q, { genres: GENRES }).conditions.map((c) => c.sql);

describe('plain-English parser', () => {
  it('1. energetic songs from the 1980s with low acousticness', () => {
    expect(where('energetic songs from the 1980s with low acousticness')).toEqual(
      expect.arrayContaining(['year BETWEEN 1980 AND 1989', 'energy >= 0.7', 'acousticness <= 0.3']),
    );
    expect(where('energetic songs from the 1980s with low acousticness')).toHaveLength(3);
  });
  it('2. two-digit decades: sad songs from the 90s', () => {
    expect(where('sad songs from the 90s')).toEqual(expect.arrayContaining(['year BETWEEN 1990 AND 1999', 'valence <= 0.3']));
  });
  it('3. decade words: happy danceable tracks from the seventies', () => {
    expect(where('happy danceable tracks from the seventies')).toEqual(
      expect.arrayContaining(['year BETWEEN 1970 AND 1979', 'valence >= 0.7', 'danceability >= 0.7']),
    );
  });
  it('4. explicit year range', () => {
    expect(where('songs between 1995 and 2005')).toEqual(['year BETWEEN 1995 AND 2005']);
  });
  it('5. after / before', () => {
    expect(where('loud songs after 2010')).toEqual(expect.arrayContaining(['year > 2010', 'loudness >= -6']));
    expect(where('quiet songs before 1970')).toEqual(expect.arrayContaining(['year < 1970', 'loudness <= -15']));
  });
  it('6. numeric comparisons', () => {
    expect(where('tempo over 150')).toEqual(['tempo > 150']);
    expect(where('songs with energy above 0.9 and valence below 0.2')).toEqual(['energy > 0.9', 'valence < 0.2']);
  });
  it('7. key and mode', () => {
    expect(where('songs in c# minor')).toEqual(["key_name = 'C# minor'"]);
    expect(where('songs in d major')).toEqual(["key_name = 'D major'"]);
    expect(where('minor key songs')).toEqual(["mode_name = 'minor'"]);
  });
  it('8. flats map to sharps', () => {
    expect(where('songs in eb minor')).toEqual(["key_name = 'D# minor'"]);
  });
  it('9. artist', () => {
    const r = parseQuery('songs by queen from the 1970s');
    expect(r.conditions.map((c) => c.sql)).toEqual(expect.arrayContaining(["artist ILIKE '%queen%' ESCAPE '\\'", 'year BETWEEN 1970 AND 1979']));
  });
  it('10. genres, longest name first', () => {
    expect(where('chill deep house tracks')).toEqual(expect.arrayContaining(["genre IN ('deep-house')", 'energy <= 0.4']));
    expect(where('hip hop and jazz')[0]).toBe("genre IN ('hip-hop', 'jazz')");
  });
  it('11. superlatives and limits', () => {
    const r = parseQuery('top 20 most danceable songs');
    expect(r.limit).toBe(20);
    expect(r.sql).toContain('ORDER BY danceability DESC');
    expect(r.sql).toContain('LIMIT 20');
  });
  it('12. clean vs explicit and outliers', () => {
    expect(where('clean instrumental songs without outliers')).toEqual(
      expect.arrayContaining(['NOT explicit', 'instrumentalness >= 0.5', 'NOT is_outlier']),
    );
    expect(where('explicit fast rap-like songs')).toEqual(expect.arrayContaining(['explicit', 'tempo >= 140', 'speechiness >= 0.33']));
  });
  it('13. very energetic beats energetic', () => {
    expect(where('very energetic songs')).toEqual(['energy >= 0.85']);
  });
  it('14. early / late decades', () => {
    expect(where('late 1960s acoustic songs')).toEqual(expect.arrayContaining(['year BETWEEN 1967 AND 1969', 'acousticness >= 0.7']));
  });
  it('15. unmatched words are reported, not silently dropped', () => {
    const r = parseQuery('purple songs with energetic vibes');
    expect(r.unmatched).toEqual(expect.arrayContaining(['purple', 'vibes']));
  });
  it('16. the SQL is always a valid SELECT with a LIMIT', () => {
    const r = parseQuery('');
    expect(r.sql.startsWith('SELECT')).toBe(true);
    expect(r.sql).toContain('LIMIT 100');
    expect(r.conditions).toHaveLength(0);
  });
  it('17. quotes in artist names are escaped', () => {
    expect(parseQuery("songs by guns n' roses").sql).toContain("'%guns n'' roses%'");
  });
});
