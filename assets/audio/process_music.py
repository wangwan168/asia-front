import os, subprocess
import numpy as np
import wave

SR = 44100
SRC = 'music_src'
OUTD = 'music'
os.makedirs(OUTD, exist_ok=True)

def decode(path):
    tmp = '/tmp/_mus.wav'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-ar', str(SR), tmp], check=True)
    with wave.open(tmp) as w:
        n, ch = w.getnframes(), w.getnchannels()
        raw = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    return raw.reshape(-1, ch) if ch > 1 else raw.reshape(-1, 1)

def encode(name, x, q='4'):
    tmp = '/tmp/_mus_out.wav'
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    dst = os.path.join(OUTD, name + '.ogg')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libvorbis', '-q:a', q, dst], check=True)
    d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst],
                       capture_output=True, text=True).stdout.strip()
    print(name, os.path.getsize(dst) // 1024, 'KB', d, 's')

def peak_norm(x, peak=0.88):
    return x / (np.max(np.abs(x)) + 1e-9) * peak

def make_loop(name, path, start, length, fade=4.0):
    x = decode(path)
    s = int(start * SR); L = int(length * SR); F = int(fade * SR)
    seg = x[s:s + L + F]
    out = seg[:L].copy()
    ramp = np.linspace(0, 1, F, dtype=np.float32)[:, None]
    out[:F] = seg[:F] * ramp + seg[L:L + F] * (1 - ramp)
    encode(name, peak_norm(out))

def make_clip(name, path, start, length, fade_in=0.3, fade_out=2.5):
    x = decode(path)
    s = int(start * SR); L = int(length * SR)
    out = x[s:s + L].copy()
    fi = int(fade_in * SR); fo = int(fade_out * SR)
    out[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)[:, None]
    out[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)[:, None]
    encode(name, peak_norm(out))

make_loop('music_menu', f'{SRC}/siegfried.src', 40, 80, 5.0)
make_loop('music_war_1', f'{SRC}/stars_stripes.src', 8, 88, 4.0)
make_loop('music_war_2', f'{SRC}/semper.src', 10, 88, 4.0)
make_loop('music_war_3', f'{SRC}/yankee_navy.src', 6, 88, 4.0)
make_clip('music_victory', f'{SRC}/stars_stripes.src', 210, 14, 0.2, 2.5)
make_clip('music_defeat', f'{SRC}/chopin.src', 2, 14, 0.4, 3.5)
print('music processing complete')
