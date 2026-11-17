// 关系/战争/同盟查询与势力强度估算（纯函数，AI 与结算共用）。

import { relationPairKey } from "../data/diplomacy";
import { TEMPLATES } from "../data/units";
import type { GameState } from "../state/types";

export { relationPairKey };

export function isAtWar(state: GameState, a: string, b: string): boolean {
  if (a === b || a === "neutral" || b === "neutral") return false;
  return state.wars.includes(relationPairKey(a, b));
}

export function isAllied(state: GameState, a: string, b: string): boolean {
  if (a === b) return true;
  return state.alliances.includes(relationPairKey(a, b));
}

/** 通行/补给友好：己方、盟友、宗主、附庸互通 */
export function isFriendlyOwner(state: GameState, factionId: string, ownerId: string): boolean {
  if (ownerId === factionId) return true;
  if (ownerId === "neutral") return false;
  if (isAllied(state, factionId, ownerId)) return true;
  const f = state.factions[factionId];
  const o = state.factions[ownerId];
  if (f && o) {
    if (f.vassalOf === ownerId || o.vassalOf === factionId) return true;
  }
  return false;
}

export function relationOf(state: GameState, a: string, b: string): number {
  return state.relations[relationPairKey(a, b)] ?? 50;
}

/** 势力总战力估算：现役人数加权 + 装备库存折算（外交接受度与 AI 决策用） */
export function factionPower(state: GameState, factionId: string): number {
  const f = state.factions[factionId];
  if (!f || !f.active) return 0;
  let power = f.stockpile.equipment * 8;
  for (const div of state.divisions) {
    if (div.factionId !== factionId) continue;
    const tpl = TEMPLATES[div.templateId];
    if (tpl) power += div.strength * (tpl.attack / 10);
  }
  for (const sup of state.supports) {
    if (sup.factionId === factionId) power += 3000;
  }
  return Math.round(power);
}

export function ownedProvinces(state: GameState, factionId: string): string[] {
  return Object.values(state.provinces)
    .filter((p) => p.ownerId === factionId)
    .map((p) => p.id);
}

/** 控制省份数（统一胜利口径：附庸省份计入宗主） */
export function controlledProvinceCount(state: GameState, factionId: string): number {
  let count = 0;
  for (const p of Object.values(state.provinces)) {
    if (p.ownerId === factionId) count += 1;
    else {
      const owner = state.factions[p.ownerId];
      if (owner && owner.vassalOf === factionId) count += 1;
    }
  }
  return count;
}

export function pushLog(state: GameState, kind: string, text: string): void {
  state.log.push({ turn: state.turn, year: state.year, month: state.month, kind, text });
}
