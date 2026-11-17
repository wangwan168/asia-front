import os
import numpy as np
from PIL import Image
from scipy import ndimage

UI = os.path.expanduser('~/workspace/ww2-asia/assets/ui')
OUT = os.path.join(UI, 'icons')

def slice_cells(path, names, ncols, nrows):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(int)
    H, W, _ = a.shape
    cw, ch = W // ncols, H // nrows
    idx = 0
    for r in range(nrows):
        for c in range(ncols):
            cell = a[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
            corners = np.concatenate([
                cell[:12, :12].reshape(-1, 3), cell[:12, -12:].reshape(-1, 3),
                cell[-12:, :12].reshape(-1, 3), cell[-12:, -12:].reshape(-1, 3)])
            bg = corners.mean(axis=0)
            dist = np.abs(cell - bg).sum(axis=2)
            mask = dist > 42
            mask = ndimage.binary_opening(mask, np.ones((4, 4)))
            lab, n = ndimage.label(mask)
            best, best_sz = None, 0
            for i in range(1, n + 1):
                sz = (lab == i).sum()
                if sz > best_sz:
                    best_sz, best = sz, i
            ys, xs = np.where(lab == best)
            x0, x1 = c * cw + xs.min(), c * cw + xs.max()
            y0, y1 = r * ch + ys.min(), r * ch + ys.max()
            pad = 8
            crop = im.crop((max(0, x0 - pad), max(0, y0 - pad),
                            min(W, x1 + pad), min(H, y1 + pad)))
            crop = crop.resize((256, 256), Image.LANCZOS)
            crop.save(os.path.join(OUT, names[idx] + '.png'))
            print(' ', names[idx], 'bbox', (x0, y0, x1, y1))
            idx += 1

slice_cells(os.path.join(UI, 'media-generation-ww2-resource-icons-0-817fe6b7-161f-43bc-a46e-44f6a036fe88.png'),
            ['res_steel', 'res_oil', 'res_grain', 'res_industry', 'res_manpower'], 5, 1)
slice_cells(os.path.join(UI, 'media-generation-ww2-nav-icons-0-c2cf82af-2a9e-4ebe-b83f-7aec43f1f7f7.png'),
            ['nav_map', 'nav_provinces', 'nav_general', 'nav_research',
             'nav_production', 'nav_diplomacy', 'nav_journal', 'nav_focus'], 4, 2)

names = ['res_steel', 'res_oil', 'res_grain', 'res_industry', 'res_manpower',
         'nav_map', 'nav_provinces', 'nav_general', 'nav_research',
         'nav_production', 'nav_diplomacy', 'nav_journal', 'nav_focus']
sheet = Image.new('RGB', (256 * 7, 256 * 2), (20, 18, 14))
for i, nm in enumerate(names):
    sheet.paste(Image.open(os.path.join(OUT, nm + '.png')), ((i % 7) * 256, (i // 7) * 256))
sheet.save(os.path.join(UI, 'icons_preview.png'))
print('SLICE-CELLS done')
