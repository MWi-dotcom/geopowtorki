"""
Generuje kafelki XYZ (Web Mercator, 256 px, WebP) z rastra Natural Earth
HYP_50M_SR_W (public domain). Uruchomienie:
  python3 scripts/make_tiles.py <ścieżka do HYP_50M_SR_W.tif> public/tiles/hyp
Wymaga: Pillow, numpy.
"""
import math, os, sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
src_path, out_dir = sys.argv[1], sys.argv[2]
MAXZ = int(sys.argv[3]) if len(sys.argv) > 3 else 5
T = 256
W = T * 2 ** MAXZ  # szerokość świata na maksymalnym zoomie

src = Image.open(src_path).convert("RGB")
sw, sh = src.size
# 1) skalowanie w poziomie (długość geograficzna jest liniowa w obu projekcjach)
src = src.resize((W, sh), Image.LANCZOS)
a = np.asarray(src)

# 2) przeliczenie wierszy: Mercator -> szerokość geogr. -> wiersz rastra equirect.
ys = (np.arange(W) + 0.5) / W  # 0..1 od góry
lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * ys))))
row = (90 - lat) / 180 * sh - 0.5
r0 = np.clip(np.floor(row).astype(int), 0, sh - 1)
r1 = np.clip(r0 + 1, 0, sh - 1)
f = (row - r0)[:, None, None]
merc = np.empty((W, W, 3), dtype=np.uint8)
CH = 512
for i in range(0, W, CH):
    s = slice(i, i + CH)
    merc[s] = (a[r0[s]] * (1 - f[s]) + a[r1[s]] * f[s]).round().astype(np.uint8)
del a
img = Image.fromarray(merc)

for z in range(MAXZ, -1, -1):
    size = T * 2 ** z
    zimg = img if size == W else img.resize((size, size), Image.LANCZOS)
    n = 2 ** z
    for x in range(n):
        d = os.path.join(out_dir, str(z), str(x))
        os.makedirs(d, exist_ok=True)
        for y in range(n):
            tile = zimg.crop((x * T, y * T, (x + 1) * T, (y + 1) * T))
            tile.save(os.path.join(d, f"{y}.webp"), "WEBP", quality=78, method=6)
    print("zoom", z, "ok")
