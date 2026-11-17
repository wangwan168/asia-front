#!/usr/bin/env python3
"""Recolor the OGA soldier texture per faction.

Rules (from inspecting the stock texture):
- skin tones            -> keep
- brown leather         -> keep
- grey metal bits       -> keep
- red (armband/insignia)-> uniform color, darkened
- dark field (uniform + background) -> uniform color, luminance shading kept
"""
from PIL import Image
import os

SRC = os.path.expanduser('~/workspace/ww2-asia/assets/models/opensource/soldier_oga/LowpolySoldier/LowpolySoldier_Texture.png')
OUTDIR = os.path.expanduser('~/workspace/ww2-asia/assets/models/opensource/tex_variants')
os.makedirs(OUTDIR, exist_ok=True)

FACTIONS = {
    'roc':   (122, 106, 66),   # Nationalist khaki
    'japan': (104, 102, 62),   # IJA yellow-green
    'ccp':   (88, 96, 104),    # CCP grey-blue
    'usa':   (100, 92, 60),    # US olive drab
    'uk':    (116, 98, 70),    # British khaki brown
}

img = Image.open(SRC).convert('RGB')
px = img.load()
W, H = img.size

def is_skin(r, g, b):
    return r > 150 and 90 < g < 195 and b < 145 and r > g > b

def is_leather(r, g, b):
    return 40 <= r <= 115 and 25 <= g <= 75 and b < 50 and r > g > b

def is_red(r, g, b):
    return r > 110 and r > g * 1.8 and r > b * 1.8

def is_grey_metal(r, g, b):
    return abs(r - g) < 25 and abs(g - b) < 25 and 60 <= r <= 175

for name, (tr, tg, tb) in FACTIONS.items():
    out = Image.new('RGB', (W, H))
    opx = out.load()
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            lum = (r + g + b) / 3.0
            if is_skin(r, g, b) or is_leather(r, g, b) or is_grey_metal(r, g, b):
                opx[x, y] = (r, g, b)
            elif is_red(r, g, b):
                f = 0.62 + 0.30 * min(lum / 170.0, 1.0)
                opx[x, y] = (int(tr * f), int(tg * f), int(tb * f))
            elif lum < 95:
                f = 0.72 + 0.28 * (lum / 95.0)
                opx[x, y] = (int(tr * f), int(tg * f), int(tb * f))
            else:
                opx[x, y] = (r, g, b)
    path = os.path.join(OUTDIR, 'soldier_tex_%s.png' % name)
    out.save(path)
    print('wrote', path)
print('done')
