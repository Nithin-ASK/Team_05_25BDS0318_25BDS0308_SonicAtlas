"""Run pytest and store the pass count in results.json -> qa."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from sonicatlas import results  # noqa: E402

out = subprocess.run([sys.executable, "-m", "pytest", "-q"], cwd=ROOT, capture_output=True, text=True).stdout
m = re.search(r"(\d+) passed", out); f_ = re.search(r"(\d+) failed", out)
passed, failed = int(m.group(1)) if m else 0, int(f_.group(1)) if f_ else 0
results.save("qa", {"pytest": f"{passed}/{passed + failed}", "pytest_passed": passed, "pytest_failed": failed})
print(out.strip().splitlines()[-1])
