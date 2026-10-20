/**
 * Runtime configuration.
 *
 * FULL_DATA_URL: the 1.2M-row parquet (tracks_full_web.parquet, ~100+ MB) is NOT shipped in
 * public/. It is published as a GitHub Release asset and fetched over HTTP range requests
 * when the user turns on "Load full dataset". Point this at the release asset URL, e.g.
 *   https://github.com/<user>/<repo>/releases/download/v1.0/tracks_full.parquet
 * (GitHub release assets need a CORS-friendly mirror; see README "Full dataset").
 * The default is a relative path (./data/tracks_full.bin.zip: a .zip name stops GitHub Pages from gzip-compressing the
 * file, which would break HTTP range reads). A local copy in public/data/ also works for development.
 */
export const FULL_DATA_URL: string =
  (import.meta.env.VITE_FULL_DATA_URL as string | undefined) || './data/tracks_full.bin.zip';

/** Base path for the exported data files (relative so it works under any GitHub Pages subpath). */
export const DATA_BASE = './data/';
export const PROFILING_BASE = './profiling/';

export const GITHUB_URL = 'https://github.com/<your-username>/Team_05_25BDS0318_25BDS0308_SonicAtlas';
export const RELEASES_URL = GITHUB_URL + '/releases';

export const DATA_FILES = {
  tracks: 'tracks_lite.parquet',
  genre: 'genre_tracks.parquet',
  embeddings: 'embeddings.parquet',
  timeseries: 'timeseries.json',
  summary: 'summary.json',
  literature: 'literature.json',
  manifest: 'manifest.json',
  lyrics: 'lyrics_web.json',
  network: 'network.json',
} as const;
