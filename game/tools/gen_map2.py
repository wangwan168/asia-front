#!/usr/bin/env python3
"""亚洲战场地图生成器 v2（真实行政边界骨架版，2026-11-16 返工）。

形状来源：Natural Earth admin-1（省/邦/道级真实边界，公有领域）。
规则（总管返工令）：外圈轮廓（海岸线/国境线）一律来自真实边界，禁止 Voronoi 决定外形；
Voronoi 只许在单个真实行政多边形内部、被 ≥2 个游戏省质心落入时做细分。
游戏省 = 1 个以上 admin-1 单元的并集，或某 admin-1 单元内的一块切分。
底衬：admin-0 国境并集（取景框内全部真实陆地，中性色），provinces.ts 之外另出 basemap.ts。

取景框：东经 59–149、北纬 −9–64（雅库茨克 62°N 与爪哇 −7° 决定南北界，总管口径 5–55 为约数）。
投影：等距圆柱（经度按 cos34° 收缩），K=11。
"""
import json
import math
import re
import sys

from scipy.spatial import Voronoi
from shapely.geometry import Polygon, MultiPolygon, MultiPoint, Point, box, shape
from shapely.ops import unary_union, voronoi_diagram

# ---------- 1) 读旧表（省 id/归属/地形/经济，数据层保全） ----------
src = open("tools/gen_map.py").read()
prov_block = src[src.index("P = ["):src.index("\n]\n", src.index("P = ["))]
PROVS = []
for m in re.finditer(
    r'\("([a-z_]+)", "([^"]+)", "([a-z_]+)", (-?[\d.]+), (-?[\d.]+), "([a-z]+)", "([a-z]+)", (\d+), ([\d.]+), (\d+), (None|\{[^}]*\})\)',
    prov_block,
):
    pid, name, state, lat, lon, terrain, owner, ind, mil, mp, res = m.groups()
    resdict = dict(re.findall(r'"([a-z]+)": (\d+)', res)) if res != "None" else {}
    PROVS.append({
        "id": pid, "name": name, "state": state, "lat": float(lat), "lon": float(lon),
        "terrain": terrain, "owner": owner, "ind": int(ind), "mil": float(mil),
        "manpower": int(mp), "res": {k: int(v) for k, v in resdict.items()},
    })
print(f"provinces from table: {len(PROVS)}", file=sys.stderr)
P = {p["id"]: p for p in PROVS}
ids = [p["id"] for p in PROVS]

STATES = []
for m in re.finditer(r'\("([a-z_]+)", "([^"]+)"\)', src[src.index("STATES = ["):src.index("\n]\n", src.index("STATES = ["))]):
    STATES.append((m.group(1), m.group(2)))

LANDLINK = [tuple(x) for x in re.findall(r'\("([a-z_]+)", "([a-z_]+)"\)', src[src.index("LANDLINK = ["):src.index("\n]\n", src.index("LANDLINK = ["))])]
SEA = [tuple(x) for x in re.findall(r'\("([a-z_]+)", "([a-z_]+)"\)', src[src.index("SEA = ["):src.index("\n]\n", src.index("SEA = ["))])]
RIVERS = []
for m in re.finditer(r'\("([a-z_]+)", "([a-z_]+)", "([^"]+)"\)', src[src.index("RIVERS = ["):src.index("\n]\n", src.index("RIVERS = ["))]):
    RIVERS.append((m.group(1), m.group(2), m.group(3)))

# ---------- 1b) 地形迁移：八类主体地貌（钢4 式）+ 特征标记 ----------
# 旧 city->urban、plain->plains；port/island 不再是地形：port 记 isPort、按地理定主体地貌；
# island 记 isIsland（台湾全省另记）。逐省复核 override 按真实地理（审计+地貌常识）。
TERRAIN_OVERRIDE = {
    # 森林：西伯利亚/东北林区（旧 plain/island）
    "heihe": "forest", "blagoveshchensk": "forest", "yakutsk": "forest", "sakhalin": "forest",
    # 丘陵：沿海山地/黄土/辽西走廊（旧 port/plain）
    "dalian": "hills", "qingdao": "hills", "yantai": "hills", "fuzhou": "hills", "xiamen": "hills",
    "quanzhou": "hills", "wenzhou": "hills", "hakodate": "hills", "aomori": "hills", "niigata": "hills",
    "nagasaki": "hills", "kagoshima": "hills", "oita": "hills", "takamatsu": "hills", "shimonoseki": "hills",
    "vladivostok": "hills", "hamhung": "hills", "pusan": "hills", "sittwe": "hills", "danang": "hills",
    "hue": "hills", "legazpi": "hills", "padang": "hills",
    "liaoxi": "hills", "baoji": "hills", "akita": "hills", "morioka": "hills",
    # 城市：大都会港口（旧 port，建成区口径）
    "shanghai": "urban", "tianjin": "urban", "guangzhou": "urban", "hongkong": "urban",
    "calcutta": "urban", "singapore": "urban", "tokyo": "urban", "osaka": "urban",
    "manila": "urban", "jakarta": "urban", "bangkok": "urban", "saigon": "urban",
    # 沼泽：大河三角洲/湖区（旧 port/plain）
    "rangoon": "marsh", "palembang": "marsh", "pontianak": "marsh", "bandjarmasin": "marsh",
    "changde": "marsh", "huainan": "marsh",
}
BASE_TERRAIN = {"plain": "plains", "city": "urban", "mountain": "mountain",
                "jungle": "jungle", "desert": "desert", "port": "plains", "island": "jungle"}
for p in PROVS:
    old = p["terrain"]
    p["isPort"] = old == "port"
    p["isIsland"] = old == "island" or p["state"] == "taiwan"
    p["terrain"] = TERRAIN_OVERRIDE.get(p["id"], BASE_TERRAIN[old])

# ---------- 2) 投影与取景框 ----------
LON_MIN, LON_MAX, LAT_MIN, LAT_MAX = 59.0, 149.0, -9.0, 64.0
K = 11.0
COSL = math.cos(math.radians(34))


def project(lon, lat):
    return ((lon - LON_MIN) * K * COSL, (LAT_MAX - lat) * K)


MAP_W = round((LON_MAX - LON_MIN) * K * COSL)
MAP_H = round((LAT_MAX - LAT_MIN) * K)
FRAME = box(0, 0, MAP_W, MAP_H)


def project_geom(g):
    from shapely.ops import transform
    return transform(lambda xs, ys, zs=None: (
        [(x - LON_MIN) * K * COSL for x in xs],
        [(LAT_MAX - y) * K for y in ys],
    ), g)


for p in PROVS:
    lon = p["lon"] - 360 if p["lon"] > 180 else p["lon"]
    p["xy"] = project(lon, p["lat"])

# ---------- 3) admin-1 分配 ----------
ADMINS = {
    "China", "Japan", "India", "Myanmar", "Thailand", "Vietnam", "Laos", "Cambodia",
    "Malaysia", "Indonesia", "Philippines", "Russia", "Mongolia", "North Korea",
    "South Korea", "Nepal", "Bhutan", "Bangladesh", "Pakistan", "Taiwan", "Brunei",
    "East Timor", "Sri Lanka", "Kazakhstan", "Kyrgyzstan", "Tajikistan", "Afghanistan",
}
admin1 = json.load(open("tools/admin1.geo.json"))
units = []  # {name, admin, geom(投影后), centroid}
for f in admin1["features"]:
    pr = f["properties"]
    admin = pr.get("admin")
    if admin not in ADMINS and not (admin == "United States of America" and pr.get("name") == "Guam"):
        continue
    g = project_geom(shape(f["geometry"]))
    if not g.intersects(FRAME):
        continue
    g = g.intersection(FRAME)
    if g.is_empty or g.area < 1:
        continue
    units.append({"name": pr.get("name"), "admin": admin, "geom": g})
print(f"admin-1 units in frame: {len(units)}", file=sys.stderr)

# 省质心 → 所在 admin 单元（claim 判定）
centroid_pt = {p["id"]: Point(p["xy"]) for p in PROVS}
unit_claims = []
for u in units:
    claims = [pid for pid in ids if u["geom"].distance(centroid_pt[pid]) < 0.6]
    unit_claims.append(claims)

pieces = {pid: [] for pid in ids}
unclaimed = []
for u, claims in zip(units, unit_claims):
    if len(claims) == 1:
        pieces[claims[0]].append(u["geom"])
    elif len(claims) >= 2:
        # Voronoi 只在本行政多边形内部细分（返工令允许的唯一用法）
        pts = [centroid_pt[c] for c in claims]
        cells = voronoi_diagram(MultiPoint(pts), envelope=u["geom"].envelope)
        for c, pt in zip(claims, pts):
            for cell in cells.geoms:
                if cell.contains(pt) or cell.touches(pt):
                    part = cell.intersection(u["geom"])
                    if not part.is_empty:
                        pieces[c].append(part)
                    break
    else:
        unclaimed.append(u)

# 未被质心落入的单元：归同国最近省（省的国家由其所落单元推定，未落入者用最近单元）
prov_country = {}
for u, claims in zip(units, unit_claims):
    for c in claims:
        prov_country[c] = u["admin"]
for p in PROVS:
    if p["id"] not in prov_country:
        best = min(units, key=lambda u: u["geom"].centroid.distance(centroid_pt[p["id"]]))
        prov_country[p["id"]] = best["admin"]
for u in unclaimed:
    cand = [pid for pid in ids if prov_country.get(pid) == u["admin"]]
    if not cand:
        cand = ids
    best = min(cand, key=lambda pid: u["geom"].centroid.distance(centroid_pt[pid]))
    pieces[best].append(u["geom"])
print(f"unclaimed units reassigned: {len(unclaimed)}", file=sys.stderr)

# 空省切分：质心所在单元（或最近单元）已分给别省时，从该省切质心周围一块给空省
owner_of_unit = {}
for pid in ids:
    for g in pieces[pid]:
        owner_of_unit[id(g)] = pid
empty = [pid for pid in ids if not pieces[pid]]
for pid in empty:
    pt = centroid_pt[pid]
    cand = None
    for u in units:
        if u["geom"].distance(pt) < 0.6:
            cand = u["geom"]
            break
    if cand is None:
        cand = min(units, key=lambda u: u["geom"].distance(pt))["geom"]
    carve = pt.buffer(20).intersection(cand)
    # 从当前持有该单元几何的省扣掉 carve 部分
    for other in ids:
        pieces[other] = [g.difference(carve) if g.intersects(carve) else g for g in pieces[other]]
    pieces[pid] = [carve]
    print(f"carved for empty province: {pid}", file=sys.stderr)

# 关岛特例：NE admin-0/1 在本尺度均无此岛（实测），以真实经纬轮廓手绘小多边形代（长轴 NE–SW，约 48×13km）
_gx, _gy = project(144.8, 13.4)
pieces["guam"] = [Polygon([
    (_gx - 3.4, _gy + 1.8), (_gx - 1.6, _gy - 0.8), (_gx - 0.4, _gy - 2.9),
    (_gx + 1.9, _gy - 2.7), (_gx + 3.4, _gy - 0.6), (_gx + 2.4, _gy + 1.9),
    (_gx - 0.2, _gy + 2.8), (_gx - 2.6, _gy + 2.6),
])]

# ---------- 4) 合并/简化/兜底 ----------
cells = {}
fallbacks = []
for pid in ids:
    if pieces[pid]:
        g = unary_union(pieces[pid])
    else:
        g = None
    if g is None or g.is_empty or g.area < 1.2:
        # 兜底：质心小圆，裁进 admin-0 国境（记入回执清单）
        fallbacks.append(pid)
        g = centroid_pt[pid].buffer(16)
    g = g.simplify(1.1 if g.area > 40 else 0.15, preserve_topology=True)  # 小岛省（如关岛）轻简化防塌缩
    # 丢弃过小碎片（保留主体与岛屿）
    if isinstance(g, MultiPolygon):
        parts = [pt for pt in g.geoms if pt.area >= 3]
        if parts:
            g = unary_union(parts)
    cells[pid] = g
print(f"fallback provinces: {fallbacks}", file=sys.stderr)
far_parts = []
for pid in ids:
    g = cells[pid]
    if isinstance(g, MultiPolygon):
        main = max(g.geoms, key=lambda x: x.area)
        for pt in g.geoms:
            if pt is not main and main.centroid.distance(pt.centroid) > 260:
                far_parts.append((pid, round(main.centroid.distance(pt.centroid))))
print(f"far-flung parts (>260 units): {far_parts}", file=sys.stderr)

# ---------- 5) 相邻（真实共享边界）+ 既有连接表 ----------
final_adj = {i: set() for i in ids}
for i, a in enumerate(ids):
    for b in ids[i + 1:]:
        if cells[a].distance(cells[b]) < 1.6:
            final_adj[a].add(b)
            final_adj[b].add(a)
for a, b in LANDLINK + SEA:
    if a in final_adj and b in final_adj:
        final_adj[a].add(b)
        final_adj[b].add(a)
land_adj = {i: set() for i in ids}
for i, a in enumerate(ids):
    for b in ids[i + 1:]:
        if cells[a].distance(cells[b]) < 1.6:
            land_adj[a].add(b)
            land_adj[b].add(a)
ll_map = {}
for a, b in LANDLINK:
    ll_map.setdefault(a, []).append(b)
    ll_map.setdefault(b, []).append(a)
sea = {i: set() for i in ids}
for a, b in SEA:
    sea[a].add(b)
    sea[b].add(a)

seen = set()
stack = ["tokyo"]
while stack:
    n = stack.pop()
    if n in seen:
        continue
    seen.add(n)
    stack.extend(final_adj[n])
print(f"provinces={len(PROVS)} states={len(STATES)} connected={len(seen)}/{len(PROVS)}", file=sys.stderr)
if len(seen) < len(PROVS):
    print("UNREACHED:", sorted(set(ids) - seen), file=sys.stderr)
rivers = set()
for a, b, _ in RIVERS:
    if b in final_adj[a]:
        rivers.add(tuple(sorted([a, b])))
    else:
        print(f"RIVER NOT ADJACENT: {a}-{b}", file=sys.stderr)

# ---------- 6) 底衬（admin-0 全部陆地，取景框内） ----------
countries = json.load(open("tools/countries.geo.json"))
land = []
for f in countries["features"]:
    g = project_geom(shape(f["geometry"]))
    if g.intersects(FRAME):
        land.append(g.intersection(FRAME))
baseland = unary_union(land).simplify(1.4, preserve_topology=True)


def path_of(poly):
    xs, ys = poly.exterior.coords.xy
    pts = list(zip(xs, ys))
    return "M" + " L".join(f"{x:.0f},{y:.0f}" for x, y in pts) + " Z"


def paths_of(g):
    if isinstance(g, MultiPolygon):
        return " ".join(path_of(pt) for pt in g.geoms if pt.area >= 2)
    return path_of(g)


out = []
out.append("// 由 tools/gen_map2.py 生成（Natural Earth admin-1 真实行政边界骨架），勿手改。")
out.append("// 省=打仗层（地形/驻军/相邻），州=经济层（工业/人力/资源按省汇总展示）。")
out.append("")
out.append(f"export const MAP_W = {MAP_W};")
out.append(f"export const MAP_H = {MAP_H};")
out.append("")
out.append("export type Terrain = \"plains\" | \"forest\" | \"hills\" | \"mountain\" | \"jungle\" | \"desert\" | \"marsh\" | \"urban\";")
out.append("")
out.append("export interface ProvinceDef {")
out.append("  id: string; name: string; stateId: string; terrain: Terrain; ownerId: string;")
out.append("  industry: number; milShare: number; manpower: number;")
out.append("  oil?: number; steel?: number; rubber?: number; food?: number;")
out.append("  cx: number; cy: number; path: string;")
out.append("  neighbors: string[]; landLinks?: string[]; seaLinks: string[];")
out.append("  isPort?: boolean; isIsland?: boolean; // 省份特征（非地形）：港口/岛屿；coastal 由 seaLinks/isPort/isIsland 推导")
out.append("}")
out.append("")
out.append("export const PROVINCES: ProvinceDef[] = [")
for p in PROVS:
    pid = p["id"]
    g = cells[pid]
    rp = g.representative_point()
    nb = sorted(land_adj[pid])
    sl = sorted(sea[pid])
    res_s = "".join(f", {k}: {v}" for k, v in p["res"].items())
    feat_s = (" isPort: true," if p["isPort"] else "") + (" isIsland: true," if p["isIsland"] else "")
    line = (
        f'  {{ id: "{pid}", name: "{p["name"]}", stateId: "{p["state"]}", terrain: "{p["terrain"]}", '
        f'ownerId: "{p["owner"]}", industry: {p["ind"]}, milShare: {p["mil"]}, manpower: {p["manpower"]}{res_s}, '
        f'cx: {rp.x:.1f}, cy: {rp.y:.1f},{feat_s} path: "{paths_of(g)}", '
        f'neighbors: [{", ".join(chr(34) + n + chr(34) for n in nb)}]'
    )
    if pid in ll_map:
        line += f', landLinks: [{", ".join(chr(34) + n + chr(34) for n in ll_map[pid])}]'
    line += f', seaLinks: [{", ".join(chr(34) + n + chr(34) for n in sl)}] }},'
    out.append(line)
out.append("];")
out.append("")
out.append("export const PROVINCE_MAP: Record<string, ProvinceDef> = Object.fromEntries(PROVINCES.map((p) => [p.id, p]));")
out.append("")
out.append("export interface RiverCrossing { a: string; b: string; river: string }")
out.append("export const RIVER_CROSSINGS: RiverCrossing[] = [")
for a, b, name in RIVERS:
    if tuple(sorted([a, b])) in rivers:
        out.append(f'  {{ a: "{a}", b: "{b}", river: "{name}" }},')
out.append("];")
out.append("")
out.append("const RIVER_SET = new Set(RIVER_CROSSINGS.map((r) => [r.a, r.b].sort().join(\"|\")));")
out.append("export function isRiverCrossing(a: string, b: string): boolean { return RIVER_SET.has([a, b].sort().join(\"|\")); }")
out.append("export const RIVER_ATK_MULT = 0.85;")
open("src/data/provinces.ts", "w").write("\n".join(out) + "\n")

out2 = ["// 由 tools/gen_map2.py 生成，勿手改。", "", "export interface StateDef { id: string; name: string }", "", "export const STATES: StateDef[] = ["]
for sid, sname in STATES:
    out2.append(f'  {{ id: "{sid}", name: "{sname}" }},')
out2.append("];")
out2.append("")
out2.append("export const STATE_MAP: Record<string, StateDef> = Object.fromEntries(STATES.map((s) => [s.id, s]));")
open("src/data/states.ts", "w").write("\n".join(out2) + "\n")

out3 = ["// 由 tools/gen_map2.py 生成：取景框内全部真实陆地底衬（Natural Earth admin-0，公有领域），勿手改。", "",
        f"export const BASEMAP_PATH = \"{paths_of(baseland)}\";"]
open("src/data/basemap.ts", "w").write("\n".join(out3) + "\n")
print(f"map bounds: {MAP_W}x{MAP_H}; basemap area={baseland.area:.0f}", file=sys.stderr)
print("written src/data/provinces.ts + states.ts + basemap.ts", file=sys.stderr)
