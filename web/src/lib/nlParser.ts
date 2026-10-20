/**
 * Transparent rule-based "plain English to SQL" parser.
 * No machine learning and no network: each rule is a regular expression with a fixed
 * SQL template. The thresholds are documented conventions (shown in the UI), not data.
 */
import { quoteString, likeEscape } from './sqlBuilder';
import { KEYS } from './features';

export interface ParsedCondition { phrase: string; sql: string; rule: string }
export interface ParseResult {
  sql: string;
  conditions: ParsedCondition[];
  orderBy?: string;
  limit: number;
  unmatched: string[];
}

/** Adjective -> condition rules. Exported so the UI can show the rule book. */
export const ADJECTIVE_RULES: { words: string[]; sql: string; rule: string }[] = [
  { words: ['very energetic', 'super energetic', 'intense'], sql: 'energy >= 0.85', rule: 'very energetic: energy >= 0.85' },
  { words: ['energetic', 'high energy', 'high-energy', 'powerful'], sql: 'energy >= 0.7', rule: 'energetic: energy >= 0.7' },
  { words: ['low energy', 'low-energy', 'calm', 'mellow', 'chill', 'relaxing', 'gentle'], sql: 'energy <= 0.4', rule: 'calm / mellow: energy <= 0.4' },
  { words: ['very danceable'], sql: 'danceability >= 0.85', rule: 'very danceable: danceability >= 0.85' },
  { words: ['danceable', 'groovy', 'high danceability'], sql: 'danceability >= 0.7', rule: 'danceable: danceability >= 0.7' },
  { words: ['not danceable', 'undanceable', 'low danceability'], sql: 'danceability <= 0.4', rule: 'not danceable: danceability <= 0.4' },
  { words: ['happy', 'cheerful', 'upbeat', 'positive', 'joyful', 'high valence'], sql: 'valence >= 0.7', rule: 'happy: valence >= 0.7' },
  { words: ['sad', 'melancholic', 'melancholy', 'gloomy', 'depressing', 'negative', 'low valence'], sql: 'valence <= 0.3', rule: 'sad: valence <= 0.3' },
  { words: ['high acousticness', 'acoustic', 'unplugged'], sql: 'acousticness >= 0.7', rule: 'acoustic: acousticness >= 0.7' },
  { words: ['low acousticness', 'electric', 'electronic', 'synthetic'], sql: 'acousticness <= 0.3', rule: 'low acousticness / electric: acousticness <= 0.3' },
  { words: ['instrumental', 'high instrumentalness', 'no vocals', 'without vocals'], sql: 'instrumentalness >= 0.5', rule: 'instrumental: instrumentalness >= 0.5' },
  { words: ['with vocals', 'vocal', 'low instrumentalness'], sql: 'instrumentalness <= 0.1', rule: 'vocal: instrumentalness <= 0.1' },
  { words: ['live', 'concert', 'high liveness'], sql: 'liveness >= 0.8', rule: 'live: liveness >= 0.8' },
  { words: ['studio', 'low liveness'], sql: 'liveness <= 0.2', rule: 'studio: liveness <= 0.2' },
  { words: ['spoken', 'speechy', 'spoken word', 'talky', 'rap-like', 'high speechiness'], sql: 'speechiness >= 0.33', rule: 'speechy: speechiness >= 0.33' },
  { words: ['low speechiness'], sql: 'speechiness <= 0.1', rule: 'low speechiness: speechiness <= 0.1' },
  { words: ['very loud'], sql: 'loudness >= -4', rule: 'very loud: loudness >= -4 dB' },
  { words: ['loud', 'high loudness'], sql: 'loudness >= -6', rule: 'loud: loudness >= -6 dB' },
  { words: ['quiet', 'soft', 'low loudness'], sql: 'loudness <= -15', rule: 'quiet: loudness <= -15 dB' },
  { words: ['very fast'], sql: 'tempo >= 160', rule: 'very fast: tempo >= 160 BPM' },
  { words: ['fast', 'high tempo', 'uptempo', 'up-tempo', 'quick'], sql: 'tempo >= 140', rule: 'fast: tempo >= 140 BPM' },
  { words: ['slow', 'low tempo', 'downtempo'], sql: 'tempo <= 90', rule: 'slow: tempo <= 90 BPM' },
  { words: ['short'], sql: 'duration_min <= 3', rule: 'short: duration <= 3 min' },
  { words: ['long', 'lengthy', 'epic'], sql: 'duration_min >= 6', rule: 'long: duration >= 6 min' },
  { words: ['not explicit', 'non-explicit', 'clean', 'family friendly', 'family-friendly'], sql: 'NOT explicit', rule: 'clean: NOT explicit' },
  { words: ['explicit'], sql: 'explicit', rule: 'explicit: explicit = true' },
  { words: ['major key', 'in major', 'major'], sql: "mode_name = 'major'", rule: "major: mode_name = 'major'" },
  { words: ['minor key', 'in minor', 'minor'], sql: "mode_name = 'minor'", rule: "minor: mode_name = 'minor'" },
  { words: ['without outliers', 'no outliers', 'excluding outliers', 'exclude outliers', 'non-outliers', 'typical'], sql: 'NOT is_outlier', rule: 'without outliers: NOT is_outlier' },
  { words: ['outliers', 'outlier', 'unusual', 'weird'], sql: 'is_outlier', rule: 'outliers: is_outlier' },
];

const FEATURE_ALIASES: Record<string, string> = {
  danceability: 'danceability', dance: 'danceability',
  energy: 'energy',
  loudness: 'loudness',
  speechiness: 'speechiness',
  acousticness: 'acousticness',
  instrumentalness: 'instrumentalness',
  liveness: 'liveness',
  valence: 'valence', positivity: 'valence', mood: 'valence',
  tempo: 'tempo', bpm: 'tempo',
  duration: 'duration_min', length: 'duration_min', minutes: 'duration_min',
  year: 'year',
};

const SUPERLATIVES: Record<string, [string, 'ASC' | 'DESC']> = {
  'most energetic': ['energy', 'DESC'], 'least energetic': ['energy', 'ASC'],
  'most danceable': ['danceability', 'DESC'], 'least danceable': ['danceability', 'ASC'],
  'happiest': ['valence', 'DESC'], 'saddest': ['valence', 'ASC'],
  'loudest': ['loudness', 'DESC'], 'quietest': ['loudness', 'ASC'],
  'fastest': ['tempo', 'DESC'], 'slowest': ['tempo', 'ASC'],
  'longest': ['duration_min', 'DESC'], 'shortest': ['duration_min', 'ASC'],
  'most acoustic': ['acousticness', 'DESC'], 'least acoustic': ['acousticness', 'ASC'],
  'most instrumental': ['instrumentalness', 'DESC'],
  'newest': ['year', 'DESC'], 'latest': ['year', 'DESC'], 'most recent': ['year', 'DESC'], 'oldest': ['year', 'ASC'],
};

const WORD_NUMBERS: Record<string, number> = { ten: 10, twenty: 20, fifty: 50, hundred: 100 };
const DECADE_WORDS: Record<string, number> = {
  fifties: 1950, sixties: 1960, seventies: 1970, eighties: 1980, nineties: 1990, noughties: 2000, 'two thousands': 2000,
};

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function decadeFrom(s: string): number | null {
  const m4 = s.match(/^(\d{4})s$/);
  if (m4) return Math.floor(Number(m4[1]) / 10) * 10;
  const m2 = s.match(/^'?(\d{2})s$/);
  if (m2) { const d = Number(m2[1]); return d >= 30 ? 1900 + d : 2000 + d; }
  return DECADE_WORDS[s] ?? null;
}

export interface ParseOptions { genres?: string[]; table?: string; defaultLimit?: number }

export function parseQuery(input: string, opts: ParseOptions = {}): ParseResult {
  const table = opts.table ?? 'tracks';
  let text = ' ' + input.toLowerCase().replace(/[,;!?]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const conditions: ParsedCondition[] = [];
  let orderBy: string | undefined;
  let orderDir: 'ASC' | 'DESC' = 'DESC';
  let limit = opts.defaultLimit ?? 100;

  const consume = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    let m: RegExpMatchArray | null;
    let guard = 0;
    while ((m = text.match(re)) && guard++ < 10) {
      fn(m);
      text = text.replace(m[0], ' ');
    }
  };

  // 1. Artist: "by <name>" (up to a stop word or end)
  consume(/ by (?:the artist |artist )?([a-z0-9&'.\- ]+?)(?= from | in the | in | with | that | which | released | between | after | before | since | during | sorted | ordered | top |$| $)/, (m) => {
    const name = m[1].trim();
    if (name) conditions.push({ phrase: m[0].trim(), sql: `artist ILIKE ${quoteString('%' + likeEscape(name) + '%')} ESCAPE '\\'`, rule: 'by <artist>: case-insensitive substring match on artist' });
  });

  // 2. Limits: "top 20", "20 songs", "first 50"
  consume(/ (?:top|first|show me|show|give me|list) (\d+|ten|twenty|fifty|hundred) /, (m) => { limit = Number(m[1]) || WORD_NUMBERS[m[1]] || limit; });
  consume(/ (\d+) (?:songs|tracks|results|rows) /, (m) => { limit = Number(m[1]); });

  // 3. Year ranges
  consume(/ (?:from|between) (\d{4}) (?:to|and|-|until|through) (\d{4}) /, (m) => {
    const a = Math.min(+m[1], +m[2]), b = Math.max(+m[1], +m[2]);
    conditions.push({ phrase: m[0].trim(), sql: `year BETWEEN ${a} AND ${b}`, rule: 'between Y1 and Y2: year range (inclusive)' });
  });
  consume(/ (?:after|since|from) (\d{4}) /, (m) => {
    const op = m[0].includes('after') ? '>' : '>=';
    conditions.push({ phrase: m[0].trim(), sql: `year ${op} ${m[1]}`, rule: 'after / since Y' });
  });
  consume(/ (?:before|until|prior to) (\d{4}) /, (m) => {
    const op = m[0].includes('until') ? '<=' : '<';
    conditions.push({ phrase: m[0].trim(), sql: `year ${op} ${m[1]}`, rule: 'before / until Y' });
  });
  consume(/ (?:in|from|of|during)? ?(?:the )?(early|late|mid)[- ](\d{4}s|'?\d{2}s|fifties|sixties|seventies|eighties|nineties) /, (m) => {
    const d = decadeFrom(m[2]);
    if (d === null) return;
    const [a, b] = m[1] === 'early' ? [d, d + 3] : m[1] === 'mid' ? [d + 3, d + 6] : [d + 7, d + 9];
    conditions.push({ phrase: m[0].trim(), sql: `year BETWEEN ${a} AND ${b}`, rule: 'early / mid / late decade: years 0-3 / 3-6 / 7-9' });
  });
  consume(/ (?:in |from |of |during )?(?:the )?(\d{4}s|'?\d{2}s|fifties|sixties|seventies|eighties|nineties|noughties) /, (m) => {
    const d = decadeFrom(m[1]);
    if (d === null) return;
    conditions.push({ phrase: m[0].trim(), sql: `year BETWEEN ${d} AND ${d + 9}`, rule: 'decade: year BETWEEN D AND D+9' });
  });
  consume(/ (?:in|from|released in) (\d{4}) /, (m) => {
    conditions.push({ phrase: m[0].trim(), sql: `year = ${m[1]}`, rule: 'in Y: exact year' });
  });

  // 4. Keys: "in C# minor", "key of D"
  consume(/ (?:in |key of )([a-g])(#|sharp| sharp|b|flat| flat)? ?(major|minor)? /, (m) => {
    let k = m[1].toUpperCase();
    const acc = (m[2] ?? '').trim();
    if (acc === '#' || acc === 'sharp') k += '#';
    if (acc === 'b' || acc === 'flat') {
      const i = KEYS.indexOf(k);
      k = KEYS[(i + 11) % 12];
    }
    if (!KEYS.includes(k)) return;
    const sql = m[3] ? `key_name = ${quoteString(`${k} ${m[3]}`)}` : `key_name IN (${quoteString(k + ' major')}, ${quoteString(k + ' minor')})`;
    conditions.push({ phrase: m[0].trim(), sql, rule: 'in <key> [major|minor]' });
  });

  // 5. Numeric comparisons: "tempo over 120", "energy above 0.8", "valence below 0.2", "more than 120 bpm"
  const featureAlt = Object.keys(FEATURE_ALIASES).map(esc).join('|');
  consume(new RegExp(` (${featureAlt}) (?:is |of )?(above|over|greater than|more than|at least|>=|>|below|under|less than|at most|<=|<) (-?\\d+(?:\\.\\d+)?) ?(?:bpm|db|minutes|min)? `), (m) => {
    const col = FEATURE_ALIASES[m[1]];
    const op = /above|over|greater|more|>$/.test(m[2]) && !m[2].includes('least') ? '>' : /least|>=/.test(m[2]) ? '>=' : /most|<=/.test(m[2]) ? '<=' : '<';
    conditions.push({ phrase: m[0].trim(), sql: `${col} ${op} ${Number(m[3])}`, rule: '<feature> above / below <number>' });
  });
  consume(/ (?:more than|over|above|faster than) (\d+(?:\.\d+)?) ?bpm /, (m) => conditions.push({ phrase: m[0].trim(), sql: `tempo > ${m[1]}`, rule: 'over N bpm' }));
  consume(/ (?:less than|under|below|slower than) (\d+(?:\.\d+)?) ?bpm /, (m) => conditions.push({ phrase: m[0].trim(), sql: `tempo < ${m[1]}`, rule: 'under N bpm' }));
  consume(/ (?:longer than|over|more than) (\d+(?:\.\d+)?) ?(?:minutes|mins|min) /, (m) => conditions.push({ phrase: m[0].trim(), sql: `duration_min > ${m[1]}`, rule: 'longer than N minutes' }));
  consume(/ (?:shorter than|under|less than) (\d+(?:\.\d+)?) ?(?:minutes|mins|min) /, (m) => conditions.push({ phrase: m[0].trim(), sql: `duration_min < ${m[1]}`, rule: 'shorter than N minutes' }));
  consume(/ between (\d+) and (\d+) ?bpm /, (m) => conditions.push({ phrase: m[0].trim(), sql: `tempo BETWEEN ${m[1]} AND ${m[2]}`, rule: 'between A and B bpm' }));

  // 6. Superlatives -> ORDER BY
  for (const [phrase, [col, dir]] of Object.entries(SUPERLATIVES)) {
    const re = new RegExp(` ${esc(phrase)} `);
    if (re.test(text)) { orderBy = col; orderDir = dir; text = text.replace(re, ' '); }
  }
  consume(/ (?:sorted|ordered|sort|order) by (\w+)(?: (asc|ascending|desc|descending))? /, (m) => {
    const col = FEATURE_ALIASES[m[1]] ?? (m[1] === 'name' || m[1] === 'artist' ? m[1] : undefined);
    if (col) { orderBy = col; orderDir = m[2]?.startsWith('asc') ? 'ASC' : 'DESC'; }
  });

  // 7. Genres (longest names first so "deep-house" beats "house")
  const genres = [...(opts.genres ?? [])].sort((a, b) => b.length - a.length);
  const found: string[] = [];
  for (const g of genres) {
    const variants = [g.toLowerCase(), g.toLowerCase().replace(/-/g, ' ')];
    for (const v of variants) {
      const re = new RegExp(` ${esc(v)} `);
      if (re.test(text)) { found.push(g); text = text.replace(re, ' '); break; }
    }
  }
  if (found.length) conditions.push({ phrase: found.join(', '), sql: `genre IN (${found.map(quoteString).join(', ')})`, rule: 'genre name (from the genre list)' });

  // 8. Adjectives (multi-word phrases first). "very X" variants are listed before plain X.
  for (const r of ADJECTIVE_RULES) {
    for (const w of [...r.words].sort((a, b) => b.length - a.length)) {
      const re = new RegExp(` ${esc(w)} `);
      if (re.test(text)) {
        conditions.push({ phrase: w, sql: r.sql, rule: r.rule });
        text = text.replace(re, ' ');
      }
    }
  }

  // Leftover meaningful words
  const STOP = new Set(['songs', 'song', 'tracks', 'track', 'music', 'with', 'and', 'the', 'a', 'an', 'from', 'in', 'of', 'that', 'are', 'is', 'which', 'me', 'show', 'find', 'give', 'all', 'some', 'very', 'really', 'quite', 'pretty', 'but', 'or', 'to', 'for', 'list', 'get', 'tunes', 'by', 'released', 'era', 'decade', 'years', 'year', 'have', 'has', 'high', 'low', 'only', 'any', 'i', 'want', 'like', 'please', 'than', 'more', 'less']);
  const unmatched = text.split(' ').filter((w) => w && !STOP.has(w));

  // Remove duplicated SQL fragments
  const seen = new Set<string>();
  const uniq = conditions.filter((c) => (seen.has(c.sql) ? false : (seen.add(c.sql), true)));

  let sql = `SELECT name, artist, year, genre, danceability, energy, valence, acousticness, tempo, loudness\nFROM ${table}`;
  if (uniq.length) sql += `\nWHERE ${uniq.map((c) => c.sql).join('\n  AND ')}`;
  if (orderBy) sql += `\nORDER BY ${orderBy} ${orderDir}`;
  sql += `\nLIMIT ${Math.max(1, Math.min(10000, limit))}`;
  return { sql, conditions: uniq, orderBy, limit, unmatched };
}
