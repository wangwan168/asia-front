import numpy as np
from PIL import Image, ImageDraw
src = Image.open('media-generation-ui-skin-buttons-0-1fea5ee7-4f5d-4a5c-9cc4-6be8b75039f5.png').convert('RGB')
a = np.asarray(src).astype(int)
lum = a.mean(axis=2)
mask = lum > 55
cols = mask.any(axis=0)
bands = []
in_b = False
for x, v in enumerate(cols):
    if v and not in_b:
        s = x; in_b = True
    elif not v and in_b:
        bands.append((s, x)); in_b = False
bands = [b for b in bands if b[1] - b[0] > 60]
print('bands:', bands)
names = ['btn_square', 'tab_on', 'tab_off', 'btn_endturn']
sizes = [(256, 256), (320, 180), (320, 180), (320, 180)]
for (x0, x1), name, (tw, th) in zip(bands, names, sizes):
    sub = mask[:, x0:x1]
    rows = sub.any(axis=1)
    ys = np.where(rows)[0]
    y0, y1 = ys.min(), ys.max()
    pad = 6
    crop = src.crop((max(x0 - pad, 0), max(y0 - pad, 0), min(x1 + pad, src.width), min(y1 + pad, src.height)))
    crop = crop.resize((tw, th), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', (tw, th), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, tw - 1, th - 1], radius=int(th * 0.10), fill=255)
    crop.putalpha(m)
    crop.save(name + '.png')
    print(name, crop.size)
