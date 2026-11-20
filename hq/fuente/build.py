"""Construye la página publicable de BWISIOM HQ a partir de la fuente.
Uso: python3 hq/fuente/build.py  -> escribe hq/fuente/bwisiom-hq.html
Solo inserta el logo (img/logo.png) como data URI WebP de 96 px."""
import base64, io, pathlib
from PIL import Image
root = pathlib.Path(__file__).resolve().parents[2]
src = (root / "hq/fuente/bwisiom-hq.src.html").read_text(encoding="utf-8")
im = Image.open(root / "img/logo.png").convert("RGB").resize((96, 96), Image.LANCZOS)
b = io.BytesIO(); im.save(b, "WEBP", quality=82)
uri = "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()
out = src.replace("%%LOGO%%", uri)
(root / "hq/fuente/bwisiom-hq.html").write_text(out, encoding="utf-8")
print("ok", len(out), "bytes")
