// 移动可达性：移动点 + 进省成本（地形×兵种适配，Dijkstra 最短成本展开），玩家与 AI 共用。
// 移动点预算 = 模板 speed × 2；进省成本 = TERRAIN_PARAMS[地形].moveCost × 兵种系数，
// 渡河边另加 RIVER_MOVE_COST（与渡河战斗惩罚分开），跨海航线固定 SEA_MOVE_COST。
// 通行规则：
// - 不得穿过交战敌方省份（游击单位例外：可渗透进入/穿过敌控省份）；
// - 跨海目标省有敌舰队支援单位时封锁；
// - 终点若是敌控省份（非游击单位）必须走 ATTACK，不能用 MOVE 占领。

import { neighborsOf, isSeaEdge } from "./mapGraph";
import { isAtWar } from "./relations";
import { ORG_MOVE_COST_PER_PROVINCE, ORG_MOVE_FLOOR } from "../data/organization";
import { TEMPLATES, type DivisionTemplate } from "../data/units";
import { PROVINCE_MAP, isRiverCrossing } from "../data/provinces";
import { TERRAIN_PARAMS, CLS_MOVE_FACTOR, RIVER_MOVE_COST, SEA_MOVE_COST } from "../data/terrain";
import type { DivisionState, GameState } from "../state/types";

export function movePointsOf(tpl: DivisionTemplate): number {
  return tpl.speed * 2;
}

/** 进入目标省的移动成本（从 fromId 跨边进入 toId）。 */
export function moveCostInto(tpl: DivisionTemplate, fromId: string, toId: string): number {
  if (isSeaEdge(fromId, toId)) return SEA_MOVE_COST;
  const terrain = PROVINCE_MAP[toId]?.terrain ?? "plains";
  let cost = TERRAIN_PARAMS[terrain].moveCost * (CLS_MOVE_FACTOR[tpl.cls]?.[terrain] ?? 1);
  if (isRiverCrossing(fromId, toId)) cost += RIVER_MOVE_COST;
  return cost;
}

/** 通行判定（行军/路径共用）：敌控省非游击不可穿，跨海目标有敌舰队封锁不可进。 */
export function canTraverse(state: GameState, div: DivisionState, cur: string, nb: string): boolean {
  const tpl = TEMPLATES[div.templateId];
  if (!tpl) return false;
  const owner = state.provinces[nb]?.ownerId ?? "neutral";
  const enemyOwned = owner !== "neutral" && isAtWar(state, div.factionId, owner);
  if (enemyOwned && !tpl.guerrilla) return false;
  if (isSeaEdge(cur, nb)) {
    const blockaded = state.supports.some(
      (s) => s.provinceId === nb && s.kind === "fleet" && isAtWar(state, div.factionId, s.factionId),
    );
    if (blockaded) return false;
  }
  return true;
}

function dijkstra(state: GameState, div: DivisionState, budget: number): Map<string, { cost: number; prev: string | null }> {
  const tpl = TEMPLATES[div.templateId]!;
  const info = new Map<string, { cost: number; prev: string | null }>([[div.provinceId, { cost: 0, prev: null }]]);
  const open: Array<[number, string]> = [[0, div.provinceId]];
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i]![0] < open[bi]![0]) bi = i;
    const [dcur, cur] = open.splice(bi, 1)[0]!;
    if (dcur > (info.get(cur)?.cost ?? Infinity)) continue;
    for (const nb of neighborsOf(cur)) {
      if (!canTraverse(state, div, cur, nb)) continue;
      const nd = dcur + moveCostInto(tpl, cur, nb);
      if (nd > budget) continue;
      if (nd < (info.get(nb)?.cost ?? Infinity)) {
        info.set(nb, { cost: nd, prev: cur });
        open.push([nd, nb]);
      }
    }
  }
  return info;
}

export function reachableWithin(state: GameState, div: DivisionState): Map<string, number> {
  const tpl = TEMPLATES[div.templateId];
  const result = new Map<string, number>();
  if (!tpl) return result;
  const info = dijkstra(state, div, movePointsOf(tpl));
  for (const [pid, v] of info) {
    if (pid !== div.provinceId && v.cost > 0) result.set(pid, v.cost);
  }
  return result;
}

/** 全图路径（不限月预算）：返回每个可达省的最廉路径（不含起点、含目标）。走不完的路由此下令、逐月续走。 */
export function findMovePaths(state: GameState, div: DivisionState): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const tpl = TEMPLATES[div.templateId];
  if (!tpl) return out;
  const info = dijkstra(state, div, Number.POSITIVE_INFINITY);
  for (const pid of info.keys()) {
    if (pid === div.provinceId) continue;
    const path: string[] = [];
    let cur: string | null = pid;
    while (cur && cur !== div.provinceId) {
      path.unshift(cur);
      cur = info.get(cur)?.prev ?? null;
    }
    if (cur === div.provinceId) out.set(pid, path);
  }
  return out;
}

/** 沿既定路径推进一个月（END_TURN 续走与下令当月共用）：按月预算逐省扣成本；
 * 路径被阻断或单步成本永远超过月预算（该兵种进不了此地形）则放弃路径停驻。 */
export function advanceAlongPath(draft: GameState, div: DivisionState): void {
  const tpl = TEMPLATES[div.templateId];
  if (!tpl || !div.pathIds || div.pathIds.length === 0) return;
  const totalBudget = movePointsOf(tpl);
  let budget = totalBudget;
  while (div.pathIds.length > 0) {
    const next = div.pathIds[0]!;
    if (!canTraverse(draft, div, div.provinceId, next)) {
      div.pathIds = undefined;
      return;
    }
    const cost = moveCostInto(tpl, div.provinceId, next);
    if (cost > totalBudget) {
      div.pathIds = undefined; // 永远走不动的一步：放弃路径
      return;
    }
    if (cost > budget) return; // 本月预算不足，下月续走
    budget -= cost;
    div.provinceId = next;
    div.org = Math.max(ORG_MOVE_FLOOR, div.org - ORG_MOVE_COST_PER_PROVINCE); // 行军耗组织度
    div.pathIds.shift();
  }
  div.pathIds = undefined;
}
