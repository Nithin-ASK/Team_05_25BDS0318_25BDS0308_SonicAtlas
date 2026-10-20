export const AUDIO_FEATURES = [
  'danceability', 'energy', 'loudness', 'speechiness', 'acousticness',
  'instrumentalness', 'liveness', 'valence', 'tempo', 'duration_min',
] as const;
export type Feature = (typeof AUDIO_FEATURES)[number];

/** The nine features used for similarity / radar (unit-bounded or scaled). */
export const PROFILE_FEATURES: Feature[] = [
  'danceability', 'energy', 'loudness', 'speechiness', 'acousticness',
  'instrumentalness', 'liveness', 'valence', 'tempo',
];

export const FEATURE_LABEL: Record<string, string> = {
  danceability: 'Danceability',
  energy: 'Energy',
  loudness: 'Loudness (dB)',
  speechiness: 'Speechiness',
  acousticness: 'Acousticness',
  instrumentalness: 'Instrumentalness',
  liveness: 'Liveness',
  valence: 'Valence',
  tempo: 'Tempo (BPM)',
  duration_min: 'Duration (min)',
  popularity: 'Popularity',
  year: 'Year',
};

/** Features whose natural range is [0, 1] (Spotify definitions). */
export const UNIT_FEATURES = new Set<string>([
  'danceability', 'energy', 'speechiness', 'acousticness', 'instrumentalness', 'liveness', 'valence',
]);

export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const TRACK_COLUMNS = [
  'id', 'name', 'artist', 'album', 'year', 'decade', 'explicit', 'key_name', 'mode_name', 'time_signature',
  ...AUDIO_FEATURES, 'genre', 'cluster', 'pc1', 'pc2', 'is_outlier',
];

export const GENRE_COLUMNS = [
  'id', 'name', 'artist', 'album', 'genre', 'popularity', 'explicit', 'key_name', 'mode_name', ...AUDIO_FEATURES, 'year',
];

export const EMBED_COLUMNS = [
  'id', 'name', 'artist', 'genre', 'popularity', 'cluster', 'danceability', 'energy', 'loudness', 'speechiness',
  'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo', 'log_duration',
  'pca_x', 'pca_y', 'tsne_x', 'tsne_y', 'lle_x', 'lle_y', 'umap_x', 'umap_y',
];

export function fmtFeature(f: string, v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  if (f === 'tempo') return v.toFixed(1);
  if (f === 'loudness') return v.toFixed(1);
  if (f === 'duration_min') return v.toFixed(2);
  if (f === 'year' || f === 'popularity') return String(Math.round(v));
  return v.toFixed(3);
}
