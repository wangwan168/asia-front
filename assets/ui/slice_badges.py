import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

UI = os.path.expanduser('~/workspace/ww2-asia/assets/ui')
OUT = os.path.join(UI, 'badges')
os.makedirs(OUT, exist_ok=True)

def extract_badge(img, box=None):
    """Cut one plaque out of a black-background image -> 256x256 transparent PNG (PIL image)."""
    if box:
        img = img.crop(box)
    a = np.asarray(img).astype(int)
    lum = a.max(axis=2)
    mask = lum > 26
    k = max(5, min(img.size) // 55)
    mask = ndimage.binary_closing(mask, np.ones((k, k)))
    mask = ndimage.binary_opening(mask, np.ones((3, 3)))
    lab, n = ndimage.label(mask)
    if n == 0:
        raise RuntimeError('no component found')
    sizes = [(lab == i).sum() for i in range(1, n + 1)]
    best = 1 + int(np.argmax(sizes))
    m = lab == best
    m = ndimage.binary_fill_holes(m)
    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    pad = 4
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(img.size[0], x1 + pad); y1 = min(img.size[1], y1 + pad)
    crop = img.crop((x0, y0, x1, y1)).convert('RGBA')
    alpha = Image.fromarray((m[y0:y1, x0:x1] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    crop.putalpha(alpha)
    canvas = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    cw, ch = crop.size
    scale = min(244 / cw, 244 / ch)
    crop = crop.resize((max(1, int(cw * scale)), max(1, int(ch * scale))), Image.LANCZOS)
    canvas.paste(crop, ((256 - crop.size[0]) // 2, (256 - crop.size[1]) // 2), crop)
    return canvas

def slice_grid(path, names, ncols, nrows, skip=()):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    cw, ch = W // ncols, H // nrows
    idx = 0
    for r in range(nrows):
        for c in range(ncols):
            if idx in skip:
                idx += 1
                continue
            badge = extract_badge(im, (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            badge.save(os.path.join(OUT, names[idx] + '.png'))
            print(' ', names[idx])
            idx += 1

slice_grid(os.path.join(UI, 'media-generation-ww2-division-badges-0-bbc6ed3d-bbe7-4a7a-94e4-fd6d41e06426.png'),
           ['div_infantry', 'div_mountain', 'div_cavalry', 'div_motorized',
            'div_armor', 'div_marine', 'div_garrison', 'div_guerrilla'], 4, 2)
slice_grid(os.path.join(UI, 'media-generation-ww2-support-badges-0-b08b1750-e796-45b8-88c4-3ef119ae208d.png'),
           ['_skip_trimotor', 'sup_bomber', 'sup_fleet', 'sup_blank'], 2, 2, skip=(0,))

fighter = extract_badge(Image.open(os.path.join(
    UI, 'media-generation-ww2-fighter-badge-0-010000d5-d10f-4468-8ea6-edbd3e0273a5.png')).convert('RGB'))
fighter.save(os.path.join(OUT, 'sup_fighter.png'))
print('  sup_fighter')

# faction-special marker: blank plaque + cream star
blank = Image.open(os.path.join(OUT, 'sup_blank.png')).convert('RGBA')
d = ImageDraw.Draw(blank)
cx, cy, R, r2 = 128, 128, 62, 25
pts = []
for i in range(10):
    ang = -np.pi / 2 + i * np.pi / 5
    rad = R if i % 2 == 0 else r2
    pts.append((cx + rad * np.cos(ang), cy + rad * np.sin(ang)))
d.polygon(pts, fill=(233, 224, 198, 255))
blank.save(os.path.join(OUT, 'div_special.png'))
print('  div_special')

names = ['div_infantry', 'div_mountain', 'div_cavalry', 'div_motorized',
         'div_armor', 'div_marine', 'div_garrison', 'div_guerrilla',
         'sup_fighter', 'sup_bomber', 'sup_fleet', 'sup_blank', 'div_special']
sheet = Image.new('RGB', (256 * 7, 256 * 2), (74, 84, 52))
for i, nm in enumerate(names):
    sheet.paste(Image.open(os.path.join(OUT, nm + '.png')),
                ((i % 7) * 256, (i // 7) * 256),
                Image.open(os.path.join(OUT, nm + '.png')))
sheet.save(os.path.join(UI, 'badges_preview.png'))
print('BADGES done:', len(names))
