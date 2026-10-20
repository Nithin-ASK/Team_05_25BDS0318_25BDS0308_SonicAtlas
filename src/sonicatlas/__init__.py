"""SonicAtlas: EDA of Spotify audio features and lyrics (Team 05, BACSE301)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
FIG = ROOT / "reports" / "figures"
TAB = ROOT / "reports" / "tables"
SEED = 42

AUDIO_FEATURES = [
    "danceability", "energy", "loudness", "speechiness", "acousticness",
    "instrumentalness", "liveness", "valence", "tempo", "duration_min",
]
UNIT_FEATURES = [
    "danceability", "energy", "speechiness", "acousticness",
    "instrumentalness", "liveness", "valence",
]
