import math
import os
from PIL import Image, ImageDraw

MARK = os.path.expanduser('~/workspace/ww2-asia/assets/tiles/markers')
SS = 4  # supersample
S = 256 * SS
BROWN = (46, 38, 32, 255)

def canvas():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))

def finish(im, name):
    im = im.resize((256, 256), Image.LANCZOS)
    im.save(os.path.join(MARK, name + '.png'))
    print(' ', name)

# ---- major city: ring + skyline ----
im = canvas()
d = ImageDraw.Draw(im)
c = S // 2
d.ellipse([c - 380, c - 380, c + 380, c + 380], outline=BROWN, width=34)
# skyline buildings (filled), centered, sitting on a ground line
gy = c + 235
for (bx, bw, bh) in ((-215, 130, 300), (-72, 150, 440), (85, 125, 260)):
    d.rectangle([c + bx, gy - bh, c + bx + bw, gy], fill=BROWN)
d.polygon([(c - 90, gy - 440), (c + 3, gy - 545), (c + 96, gy - 440)], fill=BROWN)  # roof
d.rectangle([c - 300, gy, c + 300, gy + 26], fill=BROWN)  # ground line
finish(im, 'marker_major_city')

# ---- oil: droplet ----
im = canvas()
d = ImageDraw.Draw(im)
pts = []
for t in range(0, 361, 4):
    a = math.radians(t)
    r = 300 * (0.72 + 0.28 * math.sin(a)) if t <= 180 else 300
    x = c + r * math.cos(a) * 0.92
    y = c + 60 + r * math.sin(a)
    pts.append((x, y))
# simpler robust droplet: circle bottom + triangle top
d.ellipse([c - 265, c - 60, c + 265, c + 470], fill=(34, 37, 42, 255))
d.polygon([(c - 205, c - 10), (c + 205, c - 10), (c, c - 520)], fill=(34, 37, 42, 255))
d.ellipse([c - 130, c + 120, c - 30, c + 300], fill=(210, 220, 228, 110))
finish(im, 'res_oil_map')

# ---- steel: stacked ingots ----
im = canvas()
d = ImageDraw.Draw(im)
STEEL = (118, 124, 130, 255)
EDGE = (70, 74, 80, 255)
def ingot(cx, cy, w, h):
    d.polygon([(cx - w // 2, cy + h // 2), (cx - w // 2 + 60, cy - h // 2),
               (cx + w // 2 - 60, cy - h // 2), (cx + w // 2, cy + h // 2)], fill=STEEL, outline=EDGE, width=10)
ingot(c, c + 215, 660, 150)
ingot(c - 175, c + 45, 320, 150)
ingot(c + 175, c + 45, 320, 150)
ingot(c, c - 125, 340, 150)
finish(im, 'res_steel_map')

# ---- rubber: tire ----
im = canvas()
d = ImageDraw.Draw(im)
d.ellipse([c - 360, c - 360, c + 360, c + 360], fill=(28, 28, 30, 255))
d.ellipse([c - 205, c - 205, c + 205, c + 205], fill=(112, 116, 120, 255))
d.ellipse([c - 78, c - 78, c + 78, c + 78], fill=(52, 54, 58, 255))
for k in range(5):
    a = 2 * math.pi * k / 5 - math.pi / 2
    x, y = c + 140 * math.cos(a), c + 140 * math.sin(a)
    d.ellipse([x - 26, y - 26, x + 26, y + 26], fill=(40, 42, 46, 255))
finish(im, 'res_rubber_map')

# ---- grain: wheat sheaf ----
im = canvas()
d = ImageDraw.Draw(im)
GOLD = (198, 164, 84, 255)
STEM = (150, 124, 62, 255)
d.line([c, c + 430, c, c - 380], fill=STEM, width=26)
for row in range(5):
    y = c - 330 + row * 108
    spread = 118 - row * 8
    for sgn in (-1, 1):
        x = c + sgn * spread * 0.55
        d.ellipse([x - 52, y - 88, x + 52, y + 88], fill=GOLD)
        # rotate illusion: overlay stem-colored notch
for sgn in (-1, 1):
    d.polygon([(c, c + 430), (c + sgn * 250, c + 180), (c + sgn * 130, c + 430)], fill=STEM)
d.rectangle([c - 95, c + 330, c + 95, c + 395], fill=(120, 84, 44, 255))  # tie band
finish(im, 'res_grain_map')

names = ['marker_major_city', 'res_oil_map', 'res_steel_map', 'res_rubber_map', 'res_grain_map']
sheet = Image.new('RGB', (256 * 5, 256), (74, 84, 52))
for i, nm in enumerate(names):
    ic = Image.open(os.path.join(MARK, nm + '.png'))
    sheet.paste(ic, (i * 256, 0), ic)
sheet.save(os.path.expanduser('~/workspace/ww2-asia/assets/tiles/a4a5_preview.png'))
print('A4A5 done')
