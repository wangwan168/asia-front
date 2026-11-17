#!/usr/bin/env python3
"""Self-synthesized SFX pack for Asia Front (project-original, no samples).
All sounds are generated from oscillators + filtered noise with numpy/scipy,
written as 44.1kHz mono WAV, then encoded to OGG by the caller script.
"""
import os
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wav')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1936)


def t(dur):
    return np.arange(int(SR * dur)) / SR


def tone(freq, dur, kind='sine', vol=0.5, slide_to=None):
    tt = t(dur)
    if slide_to is not None:
        f = np.linspace(freq, slide_to, len(tt))
        ph = 2 * np.pi * np.cumsum(f) / SR
    else:
        ph = 2 * np.pi * freq * tt
    if kind == 'sine':
        w = np.sin(ph)
    elif kind == 'saw':
        w = 2 * (ph / (2 * np.pi) - np.floor(0.5 + ph / (2 * np.pi)))
    elif kind == 'square':
        w = np.sign(np.sin(ph))
    return w * vol


def noise(dur, vol=0.5):
    return rng.standard_normal(int(SR * dur)) * vol


def filt(x, kind, freq, order=4):
    sos = butter(order, freq, btype=kind, fs=SR, output='sos')
    return sosfilt(sos, x)


def band(x, lo, hi, order=4):
    sos = butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return sosfilt(sos, x)


def dec(x, tau):
    tt = np.arange(len(x)) / SR
    return x * np.exp(-tt / tau)


def adsr_env(dur, a=0.005, d=0.05, s=0.4, r=0.1):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    e = np.ones(n) * s
    e[tt < a] = np.linspace(0, 1, (tt < a).sum())
    m = (tt >= a) & (tt < a + d)
    e[m] = np.linspace(1, s, m.sum())
    m2 = tt > dur - r
    e[m2] = np.linspace(s, 0, m2.sum())
    return e


def place(buf, x, at):
    i = int(at * SR)
    j = min(len(buf), i + len(x))
    buf[i:j] += x[:j - i]
    return buf


def save(name, x, peak=0.9):
    x = np.asarray(x, float)
    m = np.max(np.abs(x)) + 1e-9
    x = x / m * peak
    pcm = (x * 32767).astype(np.int16)
    import wave
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(name, round(len(x) / SR, 2), 's')


def click(pitch=2000, vol=0.7, dur=0.07):
    n = noise(dur, vol)
    c = band(n, pitch * 0.6, pitch * 1.6)
    body = dec(tone(pitch, dur, 'sine', vol * 0.8), 0.012)
    return dec(c, 0.01) + body


def thump(f0=120, f1=45, dur=0.5, vol=0.9):
    return dec(tone(f0, dur, 'sine', vol, slide_to=f1), dur * 0.45) + dec(filt(noise(dur, vol * 0.5), 'low', 220), 0.08)


def boom(at_vol=0.8, dur=1.6):
    n = filt(noise(dur, at_vol), 'low', 160)
    rumble = dec(n, 0.5) + dec(tone(52, dur, 'sine', at_vol * 0.7, slide_to=34), 0.55)
    crack = dec(band(noise(0.25, at_vol * 0.5), 300, 1500), 0.05)
    out = np.zeros(int(SR * dur))
    out = place(out, crack, 0)
    out = place(out, rumble, 0.03)
    return out


# ---------------------------------------------------------------- UI layer
def sfx_ui_click():
    save('sfx_ui_click', click(1700, 0.8, 0.08))


def sfx_ui_tab():
    save('sfx_ui_tab', click(2600, 0.55, 0.05))


def sfx_ui_panel(opening=True):
    dur = 0.32
    sw = band(noise(dur, 0.35), 500, 2600)
    tt = t(dur)
    sweep = np.sin(np.pi * tt / dur) ** 2
    x = sw * sweep
    buf = np.zeros(int(SR * (dur + 0.1)))
    buf = place(buf, x, 0)
    buf = place(buf, click(1200, 0.5, 0.06), dur - 0.02 if opening else 0.01)
    save('sfx_ui_panel_open' if opening else 'sfx_ui_panel_close', buf)


# -------------------------------------------------------------- order layer
def sfx_order_march():
    buf = np.zeros(int(SR * 0.5))
    buf = place(buf, click(1500, 0.7, 0.06), 0)
    buf = place(buf, dec(band(noise(0.16, 0.22), 900, 3200), 0.05), 0.07)  # squelch
    buf = place(buf, click(1500, 0.7, 0.06), 0.26)
    save('sfx_order_march', buf)


def sfx_order_attack():
    buf = np.zeros(int(SR * 0.55))
    for i, at in enumerate((0, 0.09, 0.18)):
        buf = place(buf, click(1900, 0.65, 0.05), at)
    buf = place(buf, thump(140, 55, 0.3, 0.7), 0.24)
    save('sfx_order_attack', buf)


def sfx_order_garrison():
    buf = np.zeros(int(SR * 0.45))
    buf = place(buf, click(1100, 0.6, 0.07), 0)
    buf = place(buf, thump(95, 50, 0.3, 0.55), 0.08)
    save('sfx_order_garrison', buf)


def sfx_order_cancel():
    buf = np.zeros(int(SR * 0.35))
    buf = place(buf, click(2100, 0.6, 0.05), 0)
    buf = place(buf, click(1400, 0.6, 0.06), 0.11)
    save('sfx_order_cancel', buf)


# ------------------------------------------------------------- battle layer
def sfx_battle_start():
    dur = 4.2
    buf = np.zeros(int(SR * dur))
    for at, v in ((0.1, 0.9), (0.7, 0.7), (1.5, 0.85), (2.3, 0.6), (3.1, 0.75)):
        buf = place(buf, boom(v, 1.4), at)
    save('sfx_battle_start', buf)


def sfx_battle_loop():
    dur = 24.0
    buf = np.zeros(int(SR * dur))
    # distant booms at irregular intervals (loop-safe: pattern wraps at 24s)
    for at, v in ((1.0, 0.55), (4.5, 0.4), (8.0, 0.6), (11.5, 0.35), (15.0, 0.5), (19.0, 0.45), (22.0, 0.38)):
        buf = place(buf, boom(v, 1.8), at)
    # gunfire crackle clusters
    for base in (2.5, 6.5, 13.0, 17.5, 21.0):
        for k in range(rng.integers(4, 9)):
            at = base + rng.uniform(0, 0.7)
            pop = dec(band(noise(0.05, 0.16), 1200, 4200), 0.015)
            buf = place(buf, pop, at)
    # low battlefield bed
    bed = filt(noise(dur, 0.05), 'low', 240)
    buf += bed
    # make loop seamless: crossfade tail into head
    fade = int(SR * 1.5)
    buf[:fade] = buf[:fade] * 0.5 + buf[-fade:] * 0.5 * np.linspace(1, 0, fade) + buf[:fade] * 0.5 * np.linspace(0, 1, fade)
    save('sfx_battle_loop', buf, peak=0.75)


def sting(notes, step, wave='saw', vol=0.4, note_dur=0.5, lp=2400):
    buf = np.zeros(int(SR * (step * len(notes) + note_dur + 0.3)))
    for i, f in enumerate(notes):
        seg = filt(tone(f, note_dur, wave, vol), 'low', lp) * adsr_env(note_dur, 0.01, 0.08, 0.6, 0.25)
        harm = filt(tone(f * 2, note_dur, 'sine', vol * 0.3), 'low', lp) * adsr_env(note_dur, 0.01, 0.08, 0.6, 0.25)
        buf = place(buf, seg + harm, i * step)
    return buf


def sfx_battle_victory():
    save('sfx_battle_victory', sting([392, 523, 659, 784], 0.13, vol=0.42))


def sfx_battle_defeat():
    save('sfx_battle_defeat', sting([330, 311, 262, 196], 0.22, vol=0.36, note_dur=0.7, lp=1500))


def sfx_province_captured():
    buf = np.zeros(int(SR * 0.9))
    for i, at in enumerate((0, 0.07, 0.14, 0.21)):
        buf = place(buf, dec(tone(1250, 0.06, 'square', 0.10), 0.03), at)
    buf = place(buf, sting([523, 659, 784], 0.09, vol=0.3, note_dur=0.35), 0.3)
    save('sfx_province_captured', buf)


def sfx_province_lost():
    buf = np.zeros(int(SR * 0.8))
    for at, f in ((0, 392), (0.28, 330)):
        seg = tone(f, 0.26, 'saw', 0.22) * adsr_env(0.26, 0.01, 0.05, 0.7, 0.12)
        buf = place(buf, filt(seg, 'low', 1300), at)
    save('sfx_province_lost', buf)


# ------------------------------------------------------------- event layer
def sfx_event_telegraph():
    buf = np.zeros(int(SR * 1.5))
    at = 0.0
    while at < 0.95:
        seg = dec(band(noise(0.03, 0.5), 1800, 4500), 0.008) + dec(tone(2400, 0.03, 'sine', 0.15), 0.008)
        buf = place(buf, seg, at)
        at += rng.uniform(0.05, 0.13)
    buf = place(buf, dec(tone(2093, 0.5, 'sine', 0.30), 0.16), 1.0)
    buf = place(buf, dec(tone(2637, 0.4, 'sine', 0.12), 0.12), 1.0)
    save('sfx_event_telegraph', buf)


def sfx_declare_war():
    buf = np.zeros(int(SR * 1.3))
    for at, v in ((0, 0.95), (0.3, 0.9), (0.55, 1.0)):
        buf = place(buf, thump(160, 48, 0.55, v), at)
    buf = place(buf, dec(band(noise(0.7, 0.25), 200, 900), 0.3), 0.55)
    save('sfx_declare_war', buf)


def sfx_peace():
    buf = np.zeros(int(SR * 1.1))
    for i, f in enumerate((523, 659)):
        buf = place(buf, dec(tone(f, 0.6, 'sine', 0.30), 0.3), i * 0.16)
        buf = place(buf, dec(tone(f * 2, 0.5, 'sine', 0.08), 0.2), i * 0.16)
    save('sfx_peace', buf)


def sfx_airraid():
    dur = 12.0
    tt = t(dur)
    cyc = (tt % 4.0) / 4.0
    tri = 1 - np.abs(2 * cyc - 1)
    f = 420 + tri * 640
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * 0.4 + np.sin(ph * 2) * 0.06
    env = np.minimum(1, np.minimum(tt / 1.2, (dur - tt) / 1.2))
    save('sfx_airraid', x * env)


def amb_hq_loop():
    dur = 30.0
    brown = filt(noise(dur, 0.5), 'low', 320)
    brown = np.cumsum(brown) / 60
    static = band(noise(dur, 0.012), 1500, 5000)
    buf = brown * 0.5 + static
    for at in (6.0, 17.0, 25.0):
        swish = band(noise(0.5, 0.03), 700, 2400) * np.sin(np.pi * t(0.5) / 0.5) ** 2
        buf = place(buf, swish, at)
    fade = int(SR * 2.0)
    buf[:fade] = buf[:fade] * np.linspace(0.5, 1, fade) + buf[-fade:] * np.linspace(0.5, 0, fade)
    save('amb_hq_loop', buf, peak=0.35)


if __name__ == '__main__':
    sfx_ui_click(); sfx_ui_tab(); sfx_ui_panel(True); sfx_ui_panel(False)
    sfx_order_march(); sfx_order_attack(); sfx_order_garrison(); sfx_order_cancel()
    sfx_battle_start(); sfx_battle_loop(); sfx_battle_victory(); sfx_battle_defeat()
    sfx_province_captured(); sfx_province_lost()
    sfx_event_telegraph(); sfx_declare_war(); sfx_peace(); sfx_airraid()
    amb_hq_loop()
    print('SFX synthesis complete')
