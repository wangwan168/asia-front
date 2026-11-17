# A1 卫星底图按现行游戏坐标系重建：GIBS BlueMarble_ShadedRelief_Bathymetry 原始渲染
# (bm_raw.png, lon 59-149 / lat -9..64, 22px/度) -> 横向 cos34 收缩到游戏帧 1642x1606 (2x)
# -> 按美术 build_basemap_v2.py 同口径调色（陆地饱和/对比/暖调、海面深板岩混合、暗角）。
# 海洋掩膜用 basemap_src/NE1_50M_LC_SR_W.tif 同法（已知海点采样色距）。
import math
import os
import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
SRC_TIF = os.path.expanduser('~/workspace/ww2-asia/assets/tiles/basemap_src/NE1_50M_LC_SR_W.tif')
TW, TH = 1642, 1606  # 游戏帧 2x（821x803 * 2）
LON_MIN, LON_MAX, LAT_MIN, LAT_MAX = 59.0, 149.0, -9.0, 64.0

bm = Image.open(os.path.join(HERE, 'bm_raw.png')).convert('RGB')
bm = bm.resize((TW, TH), Image.LANCZOS)  # 横向 1980->1642 即 cos34 收缩，纵向同尺寸
a = np.asarray(bm).astype(np.float32) / 255.0
print('satellite base:', bm.size)

# --- NE 海洋掩膜（新帧裁切） ---
PPD = 30.0  # NE1_50M: 10800x5400
ne_full = Image.open(SRC_TIF).convert('RGB')
x0, x1 = int((LON_MIN + 180) * PPD), int((LON_MAX + 180) * PPD)
y0, y1 = int((90 - LAT_MAX) * PPD), int((90 - LAT_MIN) * PPD)
ne = ne_full.crop((x0, y0, x1, y1)).resize((TW, TH), Image.LANCZOS)
na = np.asarray(ne).astype(np.float32) / 255.0

def px_at(lon, lat):
    x = int((lon - LON_MIN) / (LON_MAX - LON_MIN) * TW)
    y = int((LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * TH)
    return na[y, x]

samples = np.array([px_at(95, 0), px_at(120, 15), px_at(85, -5), px_at(142, 30), px_at(105, 3)])
oc = samples.mean(axis=0)
dist = np.abs(na - oc).sum(axis=2)
sea = (dist < 0.42).astype(np.float32)
sea = np.asarray(Image.fromarray((sea * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255.0
print('sea fraction: %.2f' % sea.mean())

# --- 调色（与美术 v2 同参数） ---
gray = a.mean(axis=2, keepdims=True)
land = gray + (a - gray) * 1.14
land = np.clip((land - 0.5) * 1.06 + 0.5, 0, 1)
land *= np.array([1.02, 1.00, 0.96])
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
img.save(os.path.join(HERE, 'basemap_sat_game_2x.png'))
img.save(os.path.join(HERE, 'basemap_sat_game_2x.webp'), quality=72, method=6)
img.resize((821, 803), Image.LANCZOS).save(os.path.join(HERE, 'basemap_sat_game_1x.webp'), quality=72, method=6)
for f in ['basemap_sat_game_2x.png', 'basemap_sat_game_2x.webp', 'basemap_sat_game_1x.webp']:
    print(f, os.path.getsize(os.path.join(HERE, f)))
print('done')
