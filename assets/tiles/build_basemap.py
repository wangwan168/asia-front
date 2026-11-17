import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

Image.MAX_IMAGE_PIXELS = None
SRC = os.path.expanduser('~/workspace/ww2-asia/assets/tiles/basemap_src')
OUT = os.path.expanduser('~/workspace/ww2-asia/assets/tiles')

# game projection: x=(lon-58)*cos30*11, y=(56-lat)*11 ; viewBox 1650x790 ; deliver 2x
KX = math.cos(math.radians(30)) * 11.0
KY = 11.0
VW, VH = 1650, 790
lon_min = 58.0
lon_max = 58.0 + VW / KX          # 231.21 (wraps past 180)
lat_max = 56.0
lat_min = 56.0 - VH / KY          # -15.82
print('frame lon %.2f..%.2f lat %.2f..%.2f' % (lon_min, lon_max, lat_min, lat_max))

PPD = 30.0  # NE raster pixels per degree (10800x5400 global)

def wrapped_crop(im):
    W, H = im.size
    x0 = int((lon_min + 180) * PPD)
    x1 = int((lon_max + 180) * PPD)          # > W: wraps
    y0 = int((90 - lat_max) * PPD)
    y1 = int((90 - lat_min) * PPD)
    left = im.crop((x0, y0, W, y1))
    right = im.crop((0, y0, x1 - W, y1))
    out = Image.new(im.mode, (left.size[0] + right.size[0], left.size[1]))
    out.paste(left, (0, 0))
    out.paste(right, (left.size[0], 0))
    return out

ne = wrapped_crop(Image.open(os.path.join(SRC, 'NE1_50M_LC_SR_W.tif')).convert('RGB'))
sr = wrapped_crop(Image.open(os.path.join(SRC, 'GRAY_50M_SR.tif')).convert('L'))
print('crop:', ne.size)

TW, TH = VW * 2, VH * 2
ne2 = ne.resize((TW, TH), Image.LANCZOS)
sr2 = sr.resize((TW, TH), Image.BILINEAR)

a = np.asarray(ne2).astype(np.float32) / 255.0
s = np.asarray(sr2).astype(np.float32) / 255.0

# --- sea mask: NE1 ocean is a pale blue; calibrate from known ocean points
def px_at(lon, lat):
    x = int((lon - lon_min) / (lon_max - lon_min) * TW)
    y = int((lat_max - lat) / (lat_max - lat_min) * TH)
    return a[y, x]
for name, lon, lat in [('IndianOcean', 95, 0), ('Pacific', 160, 20), ('SCSea', 114, 12)]:
    print(name, (px_at(lon, lat) * 255).astype(int))
oc = np.array([0.62, 0.76, 0.83])  # approx NE1 ocean tone, refined by samples below
samples = np.array([px_at(95, 0), px_at(160, 20), px_at(114, 12), px_at(85, -5), px_at(175, 45)])
oc = samples.mean(axis=0)
print('ocean tone:', (oc * 255).astype(int))
dist = np.abs(a - oc).sum(axis=2)
sea = (dist < 0.42).astype(np.float32)
sea_img = Image.fromarray((sea * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
sea = np.asarray(sea_img).astype(np.float32) / 255.0
print('sea fraction: %.2f' % sea.mean())

# --- land grade: gentle desat + warm, relief multiply
gray = a.mean(axis=2, keepdims=True)
land = a * 0.90 + gray * 0.10
land *= np.array([1.03, 1.00, 0.95])
relief = np.clip(0.86 + s * 0.28, 0.80, 1.12)  # soft extra relief
land = land * relief[..., None]

# --- sea grade: deep slate blue, latitude gradient + faint bathy relief
yy = np.linspace(0, 1, TH)[:, None]
sea_top = np.array([0.145, 0.235, 0.30])
sea_bot = np.array([0.10, 0.175, 0.235])
sea_col = sea_top[None, None, :] * (1 - yy[..., None]) + sea_bot[None, None, :] * yy[..., None]
sea_col = sea_col * np.clip(0.92 + s * 0.16, 0.88, 1.06)[..., None]

out = land * (1 - sea[..., None]) + sea_col * sea[..., None]

# gentle vignette
vx = np.linspace(-1, 1, TW)[None, :]
vy = np.linspace(-1, 1, TH)[:, None]
vig = 1 - 0.10 * np.clip(vx ** 2 + vy ** 2 - 0.6, 0, None)
out = out * vig[..., None]

out = np.clip(out * 255, 0, 255).astype(np.uint8)
img = Image.fromarray(out)
img.save(os.path.join(OUT, 'basemap_ne_2x.png'))
img.resize((VW, VH), Image.LANCZOS).save(os.path.join(OUT, 'basemap_ne_1x.png'))
print('saved basemap_ne_2x.png / basemap_ne_1x.png')

# --- alignment check: plot known cities, they must sit on the right coasts
chk = img.copy()
d = ImageDraw.Draw(chk)
def plot(lon, lat, label):
    if lon < 0:
        lon += 360
    x = (lon - 58.0) * KX * 2
    y = (56.0 - lat) * KY * 2
    d.ellipse([x - 9, y - 9, x + 9, y + 9], outline=(255, 40, 40), width=4)
    d.text((x + 14, y - 8), label, fill=(255, 60, 60))
for lon, lat, lab in [(139.7, 35.7, 'Tokyo'), (121.5, 31.2, 'Shanghai'), (103.8, 1.35, 'Singapore'),
                      (-157.8, 21.3, 'Honolulu'), (77.2, 28.6, 'Delhi'), (126.5, 45.8, 'Harbin'),
                      (114.2, 22.3, 'HongKong'), (100.5, 13.7, 'Bangkok')]:
    plot(lon, lat, lab)
chk.thumbnail((1400, 1400))
chk.save(os.path.join(OUT, 'basemap_check.png'))
print('check saved')
