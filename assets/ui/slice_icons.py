import os
import numpy as np
from PIL import Image
from scipy import ndimage

UI = os.path.expanduser('~/workspace/ww2-asia/assets/ui')
OUT = os.path.join(UI, 'icons')
os.makedirs(OUT, exist_ok=True)

def slice_sheet(path, names, min_frac=0.02):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(int)
    bg = a[5, 5]
    dist = np.abs(a - bg).sum(axis=2)
    mask = dist > 60
    mask = ndimage.binary_opening(mask, np.ones((5, 5)))
    lab, n = ndimage.label(mask)
    boxes = []
    H, W = mask.shape
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(xs) < min_frac * H * W:
            continue
        boxes.append((xs.min(), ys.min(), xs.max(), ys.max()))
    boxes.sort(key=lambda b: (round(b[1] / (H / 3)), b[0]))
    print(path.split('/')[-1], 'components:', len(boxes), 'expected:', len(names))
    for (x0, y0, x1, y1), name in zip(boxes, names):
        pad = 6
        crop = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)))
        crop = crop.resize((256, 256), Image.LANCZOS)
        crop.save(os.path.join(OUT, name + '.png'))
        print(' ', name, crop.size)

slice_sheet(os.path.join(UI, 'media-generation-ww2-resource-icons-0-817fe6b7-161f-43bc-a46e-44f6a036fe88.png'),
            ['res_steel', 'res_oil', 'res_grain', 'res_industry', 'res_manpower'])
slice_sheet(os.path.join(UI, 'media-generation-ww2-nav-icons-0-c2cf82af-2a9e-4ebe-b83f-7aec43f1f7f7.png'),
            ['nav_map', 'nav_provinces', 'nav_general', 'nav_research',
             'nav_production', 'nav_diplomacy', 'nav_journal', 'nav_focus'])
print('SLICE-ICONS done')
