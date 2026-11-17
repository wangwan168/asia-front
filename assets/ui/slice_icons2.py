import os
import numpy as np
from PIL import Image
from scipy import ndimage

UI = os.path.expanduser('~/workspace/ww2-asia/assets/ui')
OUT = os.path.join(UI, 'icons')

def bands(profile, thresh=0.04, min_w=30, gap=12):
    on = profile > thresh
    res = []
    i = 0
    while i < len(on):
        if on[i]:
            j = i
            last = i
            while j < len(on) and (on[j] or j - last <= gap):
                if on[j]:
                    last = j
                j += 1
            if last - i + 1 >= min_w:
                res.append((i, last))
            i = j
        else:
            i += 1
    return res

def slice_grid(path, names, ncols, nrows):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(int)
    bg = a[5, 5]
    dist = np.abs(a - bg).sum(axis=2)
    mask = dist > 50
    colb = bands(mask.mean(axis=0))
    rowb = bands(mask.mean(axis=1))
    print(path.split('/')[-1], 'col bands:', len(colb), 'row bands:', len(rowb))
    assert len(colb) == ncols and len(rowb) == nrows, 'band count mismatch'
    idx = 0
    for (ry0, ry1) in rowb:
        for (cx0, cx1) in colb:
            sub = mask[ry0:ry1 + 1, cx0:cx1 + 1]
            ys, xs = np.where(sub)
            x0, x1 = cx0 + xs.min(), cx0 + xs.max()
            y0, y1 = ry0 + ys.min(), ry0 + ys.max()
            pad = 6
            crop = im.crop((max(0, x0 - pad), max(0, y0 - pad),
                            min(im.width, x1 + pad), min(im.height, y1 + pad)))
            crop = crop.resize((256, 256), Image.LANCZOS)
            crop.save(os.path.join(OUT, names[idx] + '.png'))
            print(' ', names[idx], crop.size)
            idx += 1

for f in ('res_steel.png', 'res_oil.png'):
    p = os.path.join(OUT, f)
    if os.path.exists(p):
        os.remove(p)

slice_grid(os.path.join(UI, 'media-generation-ww2-resource-icons-0-817fe6b7-161f-43bc-a46e-44f6a036fe88.png'),
           ['res_steel', 'res_oil', 'res_grain', 'res_industry', 'res_manpower'], 5, 1)
slice_grid(os.path.join(UI, 'media-generation-ww2-nav-icons-0-c2cf82af-2a9e-4ebe-b83f-7aec43f1f7f7.png'),
           ['nav_map', 'nav_provinces', 'nav_general', 'nav_research',
            'nav_production', 'nav_diplomacy', 'nav_journal', 'nav_focus'], 4, 2)
print('SLICE-GRID done')
