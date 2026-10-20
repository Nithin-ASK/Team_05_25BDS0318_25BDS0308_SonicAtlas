"""Download the three public Kaggle datasets into data/raw (no credentials needed for public datasets).

If Kaggle ever requires login for these endpoints, place a token at ~/.kaggle/kaggle.json and use
`kaggle datasets download -d <slug>` instead.
"""
import zipfile
from pathlib import Path

import requests

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
SETS = {
    "spotify_12m": "rodolfofigueroa/spotify-12m-songs",
    "spotify_tracks_114k": "maharshipandya/-spotify-tracks-dataset",
    "genius_lyrics": "carlosgdcj/genius-song-lyrics-with-language-information",
}

RAW.mkdir(parents=True, exist_ok=True)
for name, slug in SETS.items():
    z = RAW / f"{name}.zip"
    if not z.exists():
        url = f"https://www.kaggle.com/api/v1/datasets/download/{slug}"
        print("downloading", slug)
        with requests.get(url, stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(z, "wb") as fh:
                for chunk in r.iter_content(1 << 20):
                    fh.write(chunk)
    if name != "genius_lyrics" and not (RAW / name).exists():  # lyrics are streamed from the zip
        zipfile.ZipFile(z).extractall(RAW / name)
print("raw data ready in", RAW)
