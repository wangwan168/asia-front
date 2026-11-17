import os
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

RAW = os.path.expanduser('~/workspace/ww2-asia/assets/ui/leaders_raw')
OUT = os.path.expanduser('~/workspace/ww2-asia/assets/ui/leaders')

def sepia_lut():
    lut = []
    stops = [(0, (26, 20, 15)), (90, (96, 74, 54)), (170, (178, 148, 112)), (255, (238, 222, 192))]
    for i in range(256):
        for (x0, c0), (x1, c1) in zip(stops, stops[1:]):
            if x0 <= i <= x1:
                t = (i - x0) / max(1, x1 - x0)
                lut.append(tuple(int(c0[k] + (c1[k] - c0[k]) * t) for k in range(3)))
                break
    return lut

LUT = sepia_lut()

def grade(img, face_xy):
    """img: 512x512 RGB. Warm sepia photo grade + face-centered light falloff."""
    g = img.convert('L')
    arr = np.asarray(g).astype(np.float32) / 255.0
    # gentle contrast
    arr = np.clip((arr - 0.5) * 1.10 + 0.52, 0, 1)
    g = Image.fromarray((arr * 255).astype(np.uint8))
    rgb = Image.merge('RGB', [g.point([c[0] for c in LUT]), g.point([c[1] for c in LUT]), g.point([c[2] for c in LUT])])
    # painterly softening: down-up resample + unsharp
    rgb = rgb.resize((288, 288), Image.LANCZOS).resize((512, 512), Image.LANCZOS)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=3, percent=68, threshold=2))
    # light falloff away from the face
    fx, fy = face_xy
    yy, xx = np.mgrid[0:512, 0:512]
    dist = np.sqrt(((xx - fx) / 340.0) ** 2 + ((yy - fy) / 340.0) ** 2)
    fall = np.clip(1.06 - 0.52 * np.clip(dist - 0.35, 0, None) ** 1.5, 0.42, 1.06)
    a = np.asarray(rgb).astype(np.float32) * fall[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

# ---- Puyi: crop head+shoulders from the Tianjin-era seated portrait
im = Image.open(os.path.join(RAW, 'Aisin-Gioro_Puyi_01.jpg')).convert('RGB')
W, H = im.size
side = int(W * 0.66)
cx, cy = int(W * 0.435), int(H * 0.30)
box = (max(0, cx - side // 2), max(0, cy - side // 2), max(0, cx - side // 2) + side, max(0, cy - side // 2) + side)
crop = im.crop(box).resize((512, 512), Image.LANCZOS)
out = grade(crop, (256, 205))
out.save(os.path.join(OUT, 'leader_manchukuo.png'))
print('leader_manchukuo from', im.size, 'crop', box)

# ---- Aung San: crop head+shoulders from the uniform portrait
im = Image.open(os.path.join(RAW, 'Aung%20San%20in%20uniform.jpg')).convert('RGB')
W, H = im.size
side = int(W * 0.80)
cx, cy = int(W * 0.50), int(H * 0.315)
x0 = min(max(0, cx - side // 2), W - side)
y0 = min(max(0, cy - side // 2), H - side)
crop = im.crop((x0, y0, x0 + side, y0 + side)).resize((512, 512), Image.LANCZOS)
out = grade(crop, (256, 195))
out.save(os.path.join(OUT, 'leader_bna.png'))
print('leader_bna from', im.size, 'crop', (x0, y0, x0 + side, y0 + side))

# comparison sheet: new two + two painted family members
sheet = Image.new('RGB', (512 * 4, 512), (20, 20, 20))
for i, n in enumerate(['leader_manchukuo', 'leader_bna', 'leader_japan', 'leader_roc']):
    sheet.paste(Image.open(os.path.join(OUT, n + '.png')).resize((512, 512)), (i * 512, 0))
sheet.thumbnail((1500, 1500))
sheet.save(os.path.join(OUT, 'leaders_photo_pair_preview.png'))
print('preview saved')
