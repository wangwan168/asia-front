import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

TILES = os.path.expanduser('~/workspace/ww2-asia/assets/tiles')
OUT = os.path.join(TILES, 'markers')
os.makedirs(OUT, exist_ok=True)

def extract(img, box):
    img = img.crop(box)
    a = np.asarray(img).astype(int)
    lum = a.max(axis=2)
    mask = lum > 26
    k = max(5, min(img.size) // 55)
    mask = ndimage.binary_closing(mask, np.ones((k, k)))
    mask = ndimage.binary_opening(mask, np.ones((3, 3)))
    lab, n = ndimage.label(mask)
    sizes = [(lab == i).sum() for i in range(1, n + 1)]
    m = lab == (1 + int(np.argmax(sizes)))
    m = ndimage.binary_fill_holes(m)
    ys, xs = np.where(m)
    x0, x1 = max(0, xs.min() - 4), min(img.size[0], xs.max() + 4)
    y0, y1 = max(0, ys.min() - 4), min(img.size[1], ys.max() + 4)
    crop = img.crop((x0, y0, x1, y1)).convert('RGBA')
    alpha = Image.fromarray((m[y0:y1, x0:x1] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    crop.putalpha(alpha)
    canvas = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    cw, ch = crop.size
    s = min(244 / cw, 244 / ch)
    crop = crop.resize((max(1, int(cw * s)), max(1, int(ch * s))), Image.LANCZOS)
    canvas.paste(crop, ((256 - crop.size[0]) // 2, (256 - crop.size[1]) // 2), crop)
    return canvas

im = Image.open(os.path.join(
    TILES, 'media-generation-ww2-combat-markers-0-df346ba5-fa7e-4ff8-ac9d-60e750047501.png')).convert('RGB')
W, H = im.size
names = ['combat_attack', 'combat_encircle', 'combat_airraid', 'combat_landing', 'combat_guerrilla']
cw = W // 5
for i, nm in enumerate(names):
    b = extract(im, (i * cw, 0, (i + 1) * cw, H))
    b.save(os.path.join(OUT, nm + '.png'))
    print(' ', nm)

sheet = Image.new('RGB', (256 * 5, 256), (74, 84, 52))
for i, nm in enumerate(names):
    ic = Image.open(os.path.join(OUT, nm + '.png'))
    sheet.paste(ic, (i * 256, 0), ic)
sheet.save(os.path.join(TILES, 'combat_markers_preview.png'))
print('COMBAT MARKERS done')
