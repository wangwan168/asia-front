#!/usr/bin/env python3
"""A2 terrain textures (8 tileable, low-contrast) + legend icons.

Textures: 256x256 seamless PNGs built from FFT periodic noise (inherently
tileable) + wrapped motifs. Luminance contrast is normalized per terrain so
the patterns stay quiet under the 0.55 faction tint (political mode) yet read
apart in terrain mode. Icons: flat pictograms in the A4/A5 marker ink.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
S = 256
rng = np.random.default_rng(20261116)
INK = (51, 43, 32)


def pfield(size, falloff, seed):
    """Periodic fractal field in [0,1] via FFT spectral falloff."""
    r = np.random.default_rng(seed)
    spec = np.fft.fft2(r.standard_normal((size, size)))
    fy = np.fft.fftfreq(size) * size
    fx = np.fft.fftfreq(size) * size
    xx, yy = np.meshgrid(fx, fy)
    rad = np.sqrt(xx ** 2 + yy ** 2)
    rad[0, 0] = 1.0
    spec *= rad ** (-falloff)
    f = np.real(np.fft.ifft2(spec))
    f -= f.min()
    return f / (f.max() + 1e-9)


def to_rgb(base, field, low, high):
    """Map field through a low->high color ramp anchored at base."""
    lo = np.array(low, float)
    hi = np.array(high, float)
    t = field[..., None]
    out = lo * (1 - t) + hi * t
    return out


def norm_contrast(img_arr, target_std):
    """Scale luminance deviation around the mean to target_std."""
    a = img_arr.astype(np.float32)
    lum = a.mean(axis=2, keepdims=True)
    cur = lum.std()
    if cur < 1e-6:
        return a
    k = target_std / cur
    return np.clip(lum + (a - lum) * 1.0 + (lum - a.mean()) * 0 + (a - a.mean(axis=(0, 1))) * 0 + (lum - lum.mean()) * (k - 1) + (a - lum) * min(k, 1.3), 0, 255)


def finish(arr, target_std, path):
    a = norm_contrast(arr, target_std)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(path)
    print('texture', os.path.basename(path))


def blobs(size, n, rmin, rmax, seed):
    """Wrapped soft-blob mask in [0,1]."""
    r = np.random.default_rng(seed)
    m = np.zeros((size, size), np.float32)
    yy, xx = np.mgrid[0:size, 0:size]
    for _ in range(n):
        cx, cy = r.uniform(0, size, 2)
        rad = r.uniform(rmin, rmax)
        amp = r.uniform(0.5, 1.0)
        for dx in (-size, 0, size):
            for dy in (-size, 0, size):
                d2 = (xx - cx - dx) ** 2 + (yy - cy - dy) ** 2
                m += amp * np.exp(-d2 / (2 * (rad / 2) ** 2))
    m /= (m.max() + 1e-9)
    return m


# ---------------------------------------------------------------- textures
def tex_plains():
    f = pfield(S, 1.6, 11) * 0.6 + pfield(S, 2.6, 12) * 0.4
    arr = to_rgb(None, f, (122, 128, 84), (152, 156, 108))
    finish(arr, 6.5, os.path.join(HERE, 'terrain_plains.png'))


def tex_forest():
    base = pfield(S, 2.0, 21)
    can = blobs(S, 260, 7, 16, 22)
    f = np.clip(base * 0.35 + can * 0.85, 0, 1)
    arr = to_rgb(None, f, (58, 74, 48), (104, 122, 82))
    finish(arr, 12, os.path.join(HERE, 'terrain_forest.png'))


def tex_hills():
    f = pfield(S, 1.1, 31)
    shade = np.clip((f - 0.5) * 2, -1, 1)
    arr = to_rgb(None, (shade * 0.5 + 0.5), (118, 106, 74), (164, 150, 104))
    finish(arr, 10, os.path.join(HERE, 'terrain_hills.png'))


def tex_mountain():
    f = pfield(S, 1.3, 41)
    ridge = 1 - np.abs(f * 2 - 1)          # ridged
    ridge = ridge ** 1.6
    arr = to_rgb(None, ridge, (88, 80, 70), (172, 162, 146))
    finish(arr, 15, os.path.join(HERE, 'terrain_mountain.png'))


def tex_jungle():
    base = pfield(S, 2.2, 51)
    can = blobs(S, 340, 9, 20, 52)
    f = np.clip(base * 0.3 + can * 0.9, 0, 1)
    arr = to_rgb(None, f, (44, 66, 38), (96, 122, 66))
    finish(arr, 13, os.path.join(HERE, 'terrain_jungle.png'))


def tex_desert():
    band = np.sin((np.arange(S)[:, None] / S) * np.pi * 6 + pfield(S, 1.4, 61) * 5)
    grain = pfield(S, 3.2, 62)
    f = np.clip(0.5 + band * 0.16 + (grain - 0.5) * 0.35, 0, 1)
    arr = to_rgb(None, f, (178, 152, 104), (214, 190, 138))
    finish(arr, 7.5, os.path.join(HERE, 'terrain_desert.png'))


def tex_marsh():
    f = pfield(S, 1.8, 71)
    water = blobs(S, 90, 10, 26, 72)
    base = to_rgb(None, f, (96, 110, 84), (128, 138, 104))
    wcol = np.array((86, 116, 112), float)
    m = (water * 0.55)[..., None]
    arr = base * (1 - m) + wcol * m
    finish(arr, 11, os.path.join(HERE, 'terrain_marsh.png'))


def tex_urban():
    f = pfield(S, 2.4, 81)
    arr = to_rgb(None, f, (138, 132, 120), (168, 162, 148))
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im, 'RGBA')
    step = 32
    for i in range(0, S + 1, step):
        d.line([(i, 0), (i, S)], fill=(110, 104, 94, 110), width=2)
        d.line([(0, i), (S, i)], fill=(110, 104, 94, 110), width=2)
    r = np.random.default_rng(82)
    for _ in range(300):
        x, y = r.uniform(0, S, 2)
        s = r.uniform(2, 5)
        d.rectangle([x, y, x + s, y + s], fill=(104, 98, 88, 90))
    finish(np.asarray(im).astype(np.float32), 8.5, os.path.join(HERE, 'terrain_urban.png'))


# ------------------------------------------------------------------- icons
SS = 4
W = 256 * SS


def icon_canvas():
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def save_icon(im, name):
    im.resize((256, 256), Image.LANCZOS).save(os.path.join(HERE, 'legend_' + name + '.png'))
    print('icon', name)


def u(v):
    return v * SS


def icon_plains():
    im, d = icon_canvas()
    for i, y in enumerate((150, 185, 218)):
        pts = [(u(x), u(y) + u(10) * np.sin(x / 34 + i * 1.7)) for x in range(28, 229, 8)]
        d.line(pts, fill=INK + (255,), width=u(9))
    for x in (64, 128, 192):
        for dx in (-9, 0, 9):
            d.line([(u(x + dx), u(132)), (u(x + dx * 2), u(104))], fill=INK + (255,), width=u(7))
    save_icon(im, 'plains')


def icon_forest():
    im, d = icon_canvas()
    for cx, s in ((70, 62), (128, 78), (186, 62)):
        for tier in range(3):
            wdt = s * (1 - tier * 0.26)
            y0 = 196 - tier * 34
            d.polygon([(u(cx - wdt / 2), u(y0)), (u(cx + wdt / 2), u(y0)), (u(cx), u(y0 - 52))], fill=INK + (255,))
        d.rectangle([u(cx - 6), u(196), u(cx + 6), u(222)], fill=INK + (255,))
    save_icon(im, 'forest')


def icon_hills():
    im, d = icon_canvas()
    d.arc([u(30), u(96), u(160), u(226)], 180, 360, fill=INK + (255,), width=u(11))
    d.arc([u(104), u(76), u(234), u(226)], 180, 360, fill=INK + (255,), width=u(11))
    d.line([(u(24), u(226)), (u(232), u(226))], fill=INK + (255,), width=u(9))
    save_icon(im, 'hills')


def icon_mountain():
    im, d = icon_canvas()
    d.polygon([(u(28), u(222)), (u(104), u(66)), (u(180), u(222))], outline=INK + (255,), width=u(11))
    d.polygon([(u(120), u(222)), (u(178), u(110)), (u(230), u(222))], outline=INK + (255,), width=u(11))
    d.polygon([(u(88), u(102)), (u(104), u(66)), (u(122), u(104)), (u(112), u(94)), (u(103), u(108)), (u(95), u(92))], fill=INK + (255,))
    d.line([(u(24), u(226)), (u(232), u(226))], fill=INK + (255,), width=u(9))
    save_icon(im, 'mountain')


def icon_jungle():
    im, d = icon_canvas()
    # palm: curved trunk + fronds
    pts = [(u(96 + 26 * np.sin(t / 60)), u(226 - t)) for t in range(0, 121, 6)]
    d.line(pts, fill=INK + (255,), width=u(10))
    top = (u(122), u(102))
    for ang in (-160, -115, -70, -25, 15):
        ex = top[0] + u(58) * np.cos(np.radians(ang))
        ey = top[1] + u(40) * np.sin(np.radians(ang)) + u(14)
        d.arc([min(top[0], ex), min(top[1], ey) - u(8), max(top[0], ex), max(top[1], ey) + u(22)], 0, 360, fill=INK + (255,), width=u(7))
    # broadleaf canopy right
    d.ellipse([u(142), u(120), u(226), u(196)], outline=INK + (255,), width=u(10))
    d.line([(u(184), u(196)), (u(184), u(226))], fill=INK + (255,), width=u(9))
    d.line([(u(24), u(228)), (u(232), u(228))], fill=INK + (255,), width=u(9))
    save_icon(im, 'jungle')


def icon_desert():
    im, d = icon_canvas()
    d.ellipse([u(158), u(36), u(218), u(96)], outline=INK + (255,), width=u(10))
    pts = [(u(x), u(196) + u(26) * np.sin((x - 20) / 66)) for x in range(24, 233, 8)]
    d.line(pts, fill=INK + (255,), width=u(10))
    pts2 = [(u(x), u(224) + u(18) * np.sin((x - 10) / 52)) for x in range(24, 233, 8)]
    d.line(pts2, fill=INK + (255,), width=u(9))
    save_icon(im, 'desert')


def icon_marsh():
    im, d = icon_canvas()
    for x in (84, 128, 172):
        d.line([(u(x), u(150)), (u(x), u(66))], fill=INK + (255,), width=u(8))
        d.ellipse([u(x - 9), u(48), u(x + 9), u(92)], fill=INK + (255,))
    for i, y in enumerate((176, 208)):
        pts = [(u(x), u(y) + u(8) * np.sin(x / 26 + i * 2.1)) for x in range(28, 229, 8)]
        d.line(pts, fill=INK + (255,), width=u(9))
    save_icon(im, 'marsh')


def icon_urban():
    im, d = icon_canvas()
    for x, wdt, hgt in ((36, 52, 108), (100, 60, 148), (172, 48, 88)):
        d.rectangle([u(x), u(226 - hgt), u(x + wdt), u(226)], outline=INK + (255,), width=u(10))
        for wy in range(226 - hgt + 20, 214, 26):
            for wx in range(x + 12, x + wdt - 8, 20):
                d.rectangle([u(wx), u(wy), u(wx + 9), u(wy + 11)], fill=INK + (255,))
    d.line([(u(24), u(230)), (u(232), u(230))], fill=INK + (255,), width=u(9))
    save_icon(im, 'urban')


if __name__ == '__main__':
    tex_plains(); tex_forest(); tex_hills(); tex_mountain()
    tex_jungle(); tex_desert(); tex_marsh(); tex_urban()
    icon_plains(); icon_forest(); icon_hills(); icon_mountain()
    icon_jungle(); icon_desert(); icon_marsh(); icon_urban()
    print('A2 build complete')
