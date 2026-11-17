import { PROVINCE_MAP } from "../data/provinces";

/** 全部相邻（陆地共享边界 + 海峡陆路连接 + 跨海航线）。 */
export function neighborsOf(provinceId: string): string[] {
  const def = PROVINCE_MAP[provinceId];
  if (!def) return [];
  const all = new Set<string>([...def.neighbors, ...(def.landLinks ?? []), ...def.seaLinks]);
  return [...all];
}

export function areAdjacent(a: string, b: string): boolean {
  return neighborsOf(a).includes(b);
}

/** 是否跨海边（两栖登陆判定用）：在 seaLinks 中即跨海。 */
export function isSeaEdge(a: string, b: string): boolean {
  const da = PROVINCE_MAP[a];
  const db = PROVINCE_MAP[b];
  return Boolean(da?.seaLinks.includes(b) || db?.seaLinks.includes(a));
}

/** 质心欧氏距离（AI 机动选目标用，替代旧六角距离）。 */
export function centroidDistance(a: string, b: string): number {
  const da = PROVINCE_MAP[a];
  const db = PROVINCE_MAP[b];
  if (!da || !db) return Number.POSITIVE_INFINITY;
  return Math.hypot(da.cx - db.cx, da.cy - db.cy);
}

/** 从起点出发、只经过满足 pred 的省份的 BFS 可达集合（补给线用）。 */
export function reachableThrough(start: string, pred: (provinceId: string) => boolean): Set<string> {
  const seen = new Set<string>();
  if (!pred(start)) return seen;
  const queue = [start];
  seen.add(start);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nb of neighborsOf(cur)) {
      if (!seen.has(nb) && pred(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  return seen;
}
