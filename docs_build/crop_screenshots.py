"""Crop the top 16:10 viewport of each full-page website screenshot for slides and documents."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
src, dst = ROOT / "web" / "screenshots", ROOT / "reports" / "figures"
for p in sorted(src.glob("*.png")):
    im = Image.open(p)
    w, h = im.size
    im.crop((0, 0, w, min(h, int(w * 10 / 16)))).save(dst / f"web_{p.stem}.png")
print("cropped", len(list(src.glob('*.png'))))
