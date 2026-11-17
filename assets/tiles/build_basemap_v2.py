import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

Image.MAX_IMAGE_PIXELS = None
SRC = os.path.expanduser('~/workspace/ww2-asia/assets/tiles/basemap_src')
OUT = os.path.expanduser('~/workspace/ww2-asia/assets/tiles')
TW, TH = 3300, 1580

# --- stitch the two GIBS parts (already rendered in the game frame at 2x)
p1 = Image.open(os.path.join(SRC, 'bm_part1.png')).convert('RGB')
p2 = Image.open(os.path.join(SRC, 'bm_part2.png')).convert('RGB')
bm = Image.new('RGB', (TW, TH))
bm.paste(p1, (0, 0))
bm.paste(p2, (p1.size[0], 0))
a = np.asarray(bm).astype(np.float32) / 255.0
print('satellite base:', bm.size)

# --- rebuild the NE sea mask at the same frame (from build_basemap.py logic)
KX = math.cos(math.radians(30)) * 11.0
lon_min, lon_max, lat_max, lat_min = 58.0, 58.0 + 1650 / KX, 56.0, 56.0 - 790 / 11.0
PPD = 30.0

def wrapped_crop(im):
    W, H = im.size
    x0 = int((lon_min + 180) * PPD)
    x1 = int((lon_max + 180) * PPD)
    y0 = int((90 - lat_max) * PPD)
    y1 = int((90 - lat_min) * PPD)
    left = im.crop((x0, y0, W, y1))
    right = im.crop((0, y0, x1 - W, y1))
    out = Image.new(im.mode, (left.size[0] + right.size[0], left.size[1]))
    out.paste(left, (0, 0))
    out.paste(right, (left.size[0], 0))
    return out

ne = wrapped_crop(Image.open(os.path.join(SRC, 'NE1_50M_LC_SR_W.tif')).convert('RGB'))
ne2 = ne.resize((TW, TH), Image.LANCZOS)
na = np.asarray(ne2).astype(np.float32) / 255.0

def px_at(lon, lat):
    x = int((lon - lon_min) / (lon_max - lon_min) * TW)
    y = int((lat_max - lat) / (lat_max - lat_min) * TH)
    return na[y, x]

samples = np.array([px_at(95, 0), px_at(160, 20), px_at(114, 12), px_at(85, -5), px_at(175, 45)])
oc = samples.mean(axis=0)
dist = np.abs(na - oc).sum(axis=2)
sea = (dist < 0.42).astype(np.float32)
sea = np.asarray(Image.fromarray((sea * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255.0
print('sea fraction: %.2f' % sea.mean())

# --- grade
# land: richer saturation + gentle contrast S-curve + slight warm
gray = a.mean(axis=2, keepdims=True)
land = gray + (a - gray) * 1.14
land = np.clip((land - 0.5) * 1.06 + 0.5, 0, 1)
land *= np.array([1.02, 1.00, 0.96])
# sea: keep satellite bathymetry but pull toward deep slate
yy = np.linspace(0, 1, TH)[:, None]
slate = (np.array([0.145, 0.235, 0.30])[None, None, :] * (1 - yy[..., None])
         + np.array([0.10, 0.175, 0.235])[None, None, :] * yy[..., None])
sea_col = a * 0.45 + slate * 0.55
sea_col = np.clip((sea_col - 0.5) * 1.03 + 0.5, 0, 1)

out = land * (1 - sea[..., None]) + sea_col * sea[..., None]
vx = np.linspace(-1, 1, TW)[None, :]
vy = np.linspace(-1, 1, TH)[:, None]
vig = 1 - 0.08 * np.clip(vx ** 2 + vy ** 2 - 0.6, 0, None)
out = np.clip(out * vig[..., None] * 255, 0, 255).astype(np.uint8)

img = Image.fromarray(out)
img.save(os.path.join(OUT, 'basemap_sat_2x.png'))
img.resize((1650, 790), Image.LANCZOS).save(os.path.join(OUT, 'basemap_sat_1x.png'))
print('saved basemap_sat_2x/1x')

chk = img.copy()
d = ImageDraw.Draw(chk)
def plot(lon, lat, label):
    if lon < 0:
        lon += 360
    x = (lon - 58.0) * KX * 2
    y = (56.0 - lat) * 11.0 * 2
    d.ellipse([x - 9, y - 9, x + 9, y + 9], outline=(255, 40, 40), width=4)
    d.text((x + 14, y - 8), label, fill=(255, 60, 60))
for lon, lat, lab in [(139.7, 35.7, 'Tokyo'), (121.5, 31.2, 'Shanghai'), (103.8, 1.35, 'Singapore'),
                      (-157.8, 21.3, 'Honolulu'), (77.2, 28.6, 'Delhi'), (126.5, 45.8, 'Harbin'),
                      (114.2, 22.3, 'HongKong'), (100.5, 13.7, 'Bangkok')]:
    plot(lon, lat, lab)
chk.thumbnail((1400, 1400))
chk.save(os.path.join(OUT, 'basemap_sat_check.png'))
print('check saved')
