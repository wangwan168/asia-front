import json
import math
import os

SRC = os.path.expanduser('~/workspace/ww2-asia/assets/tiles/basemap_src')
OUT = os.path.expanduser('~/workspace/ww2-asia/assets/tiles')
KX = math.cos(math.radians(30)) * 11.0
KY = 11.0

def proj(lon, lat):
    if lon < 0:
        lon += 360
    return ((lon - 58.0) * KX, (56.0 - lat) * KY)

def dp(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1e-9
        worst, wi = -1, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            dist = abs((px - ax) * dy - (py - ay) * dx) / L
            if dist > worst:
                worst, wi = dist, i
        if worst > tol:
            keep[wi] = True
            stack.append((a, wi))
            stack.append((wi, b))
    return [p for p, k in zip(pts, keep) if k]

RIVERS = {
    'yangtze':   ('长江', ['Yangtze']),
    'yellow':    ('黄河', ['Huang', 'Yellow']),
    'pearl':     ('珠江', ['Nanpan', 'Hongshui', 'Xun', 'Xi']),
    'mekong':    ('湄公河', ['Mekong']),
    'amur':      ('黑龙江', ['Amur']),
    'ganges':    ('恒河', ['Ganges']),
    'irrawaddy': ('伊洛瓦底江', ['Irrawaddy', 'Irrawaddy Delta']),
    'salween':   ('萨尔温江', ['Salween']),
}
alias = {}
for rid, (_, names) in RIVERS.items():
    for n in names:
        alias[n] = rid

d = json.load(open(os.path.join(SRC, 'ne_10m_rivers.geojson')))
segs = {rid: [] for rid in RIVERS}
for f in d['features']:
    p = f['properties']
    n = p.get('name_en') or p.get('name')
    rid = alias.get(n)
    if not rid:
        continue
    g = f['geometry']
    lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    for line in lines:
        lons = [c[0] for c in line]
        lats = [c[1] for c in line]
        # sanity: all eight rivers live in 70..145E, 5..55N
        if not (70 < sum(lons) / len(lons) < 145 and 5 < sum(lats) / len(lats) < 55):
            continue
        # Pearl main stem (Nanpan/Hongshui/Xun/Xi) must stay inside the Pearl basin
        if rid == 'pearl' and not (100 < sum(lons) / len(lons) < 117 and 20 < sum(lats) / len(lats) < 27):
            continue
        pts = [proj(lon, lat) for lon, lat in line]
        pts = [(round(x, 1), round(y, 1)) for x, y in pts if -30 <= x <= 1680 and -30 <= y <= 820]
        if len(pts) < 2:
            continue
        segs[rid].append(dp(pts, 0.55))

paths = {}
for rid, lines in segs.items():
    parts = []
    total = 0
    for pts in lines:
        total += len(pts)
        parts.append('M' + ' L'.join('%.1f,%.1f' % p for p in pts))
    paths[rid] = ' '.join(parts)
    print(rid, RIVERS[rid][0], 'segments:', len(lines), 'points:', total)

svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1650 790">',
       '<!-- Asia Front river layer. Projection: x=(lon-58)*cos30*11, y=(56-lat)*11.',
       '     Source: Natural Earth 10m rivers/lake centerlines (public domain). -->',
       '<g fill="none" stroke="#8fc3d8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">']
for rid in RIVERS:
    svg.append('<path id="%s" d="%s"/>' % (rid, paths[rid]))
svg.append('</g></svg>')
open(os.path.join(OUT, 'rivers.svg'), 'w').write('\n'.join(svg))
json.dump({rid: {'name_cn': RIVERS[rid][0], 'd': paths[rid]} for rid in RIVERS},
          open(os.path.join(OUT, 'rivers.json'), 'w'), ensure_ascii=False, indent=1)
print('rivers.svg / rivers.json written')
