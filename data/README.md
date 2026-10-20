# Data

All data are public Kaggle datasets, downloaded on **20 October 2026** with `docs_build/download_data.py`
(public download endpoint, no credentials). Files in `raw/` are never edited; SHA-256 checksums are in
`CHECKSUMS.txt` (written by notebook 01). `raw/`, `interim/` and `processed/` are git-ignored because of their size.

| Folder | Dataset | Source URL | Licence (as stated on Kaggle) | Rows |
|---|---|---|---|---|
| `raw/spotify_12m/tracks_features.csv` | Spotify 1.2M+ Songs | https://www.kaggle.com/datasets/rodolfofigueroa/spotify-12m-songs | "Unknown" (Kaggle API `licenseName`, 20 Oct 2026) | 1,204,025 |
| `raw/spotify_tracks_114k/dataset.csv` | Spotify Tracks Dataset | https://www.kaggle.com/datasets/maharshipandya/-spotify-tracks-dataset | "Database: Open Database, Contents: (c) Original Authors" (Kaggle API) | 114,000 |
| `raw/genius_lyrics.zip` (`song_lyrics.csv`, 9.07 GB) | Genius Song Lyrics with Language Information | https://www.kaggle.com/datasets/carlosgdcj/genius-song-lyrics-with-language-information | "Unknown" (Kaggle API) | see `results.json -> lyrics.n_total` |

> Licence note: licences were read from the Kaggle API field `licenseName` on 20 Oct 2026. Two datasets state
> "Unknown", so this project uses them for non-commercial academic analysis only and the website ships derived,
> reduced tables (numeric audio descriptors, titles, artist names) rather than the raw files. Lyrics text is NOT
> redistributed; only aggregate statistics (n-gram counts, sentiment scores) are published.

## Processed tables (`processed/`)

| File | Rows | Built by | Content |
|---|---|---|---|
| `tracks.parquet` | 1,204,025 | nb 02 | cleaned main table (types fixed, MICE-imputed tempo, flags) |
| `tracks_minmax.parquet`, `tracks_standard.parquet` | 1,204,025 | nb 02 | Min-Max and z-score scaled audio features |
| `genre_tracks.parquet` | 89,740 | nb 02 | de-duplicated genre table with popularity and (where joined) year |
| `embeddings_genre_sample.parquet` | 10,000 | nb 05 | PCA / t-SNE / LLE / UMAP coordinates + cluster |
| `track_clusters.parquet` | 1,204,025 | nb 05 | KMeans cluster and PC1-PC3 per track |
| `yearly_means.parquet` | 62 | nb 06 | yearly feature means 1959-2020 |
| `lyrics_sample.parquet`, `lyrics_sentiment.parquet` | see results.json | nb 07 | lyric statistics and sentiment |
| `network.json` | 300 nodes | nb 10 | artist collaboration subgraph |
| `tracks_full_web.parquet` | 1,204,025 | web_export | full tier for the website (load on demand) |

## Column dictionary (main table `tracks.parquet`)

| Column | Type | Meaning |
|---|---|---|
| id | str | Spotify track ID |
| name, album, album_id | str | track title, album title, album ID ("Unknown" where missing) |
| artists / artist_main / n_artists | str / str / int | raw artist list string, first artist, number of artists |
| track_number, disc_number | int | position on the album |
| explicit | bool | explicit-lyrics flag |
| danceability, energy, speechiness, acousticness, instrumentalness, liveness, valence | float 0-1 | Spotify audio descriptors |
| key, key_name | int, str | pitch class 0-11 and readable key such as "C# minor" |
| mode, mode_name | int, str | 1 = major, 0 = minor |
| loudness | float (dB) | average loudness |
| tempo / tempo_raw / tempo_imputed | float (BPM) / float / bool | MICE-repaired tempo, original value, whether it was imputed (original 0 BPM) |
| duration_ms, duration_min, log_duration | int / float / float | length, minutes, log(1 + minutes) |
| time_signature | float | beats per bar (0 values imputed) |
| year, decade | int | release year (year 0 set missing), decade |
| release_date, date_precision | datetime, str | parsed date and its precision (day / month / year) |
| is_canonical | bool | earliest release of each normalised title + main artist |
| track_genre | str | genre label joined from the genre table (about 10% of genre tracks match) |
| iso_score, is_outlier | float, bool | Isolation Forest anomaly score and flag (2% contamination) |
| yj_* | float | Yeo-Johnson transformed skewed features |
