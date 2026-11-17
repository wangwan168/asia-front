// 省份点选命中判定（2D P0 与 3D 射线拾取共用）：游戏坐标 → 省份 id。
import { PROVINCES } from "../data/provinces";

/** 省多边形点表（模块加载时解析一次）。 */
export const PROVINCE_POLYS: Map<string, number[][][]> = (() => {
  const map = new Map<string, number[][][]>();
  for (const p of PROVINCES) {
    const subs: number[][][] = [];
    for (const sub of p.path.split("M").slice(1)) {
      const pts: number[][] = [];
      const re = /(-?[\d.]+),(-?[\d.]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(sub)) !== null) pts.push([Number(m[1]), Number(m[2])]);
      if (pts.length >= 3) subs.push(pts);
    }
    map.set(p.id, subs);
  }
  return map;
})();

export function pointInPolygon(x: number, y: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!; const [xj, yj] = poly[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 游戏坐标 → 命中的省份 id（无省份覆盖处返回 null，如海面）。 */
export function provinceAtPoint(gx: number, gy: number): string | null {
  for (const p of PROVINCES) {
    if (Math.abs(gx - p.cx) > 90 || Math.abs(gy - p.cy) > 90) continue;
    const subs = PROVINCE_POLYS.get(p.id)!;
    if (subs.some((poly) => pointInPolygon(gx, gy, poly))) return p.id;
  }
  return null;
}
