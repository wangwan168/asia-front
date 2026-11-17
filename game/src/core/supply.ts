// 补给线判定：从首都出发、只经己方/友好省份可达的省份集合即「有补给」。
// 孤岛/包围圈省份的部队在月结算时衰减（游击单位豁免，见 settlement）。

import { FACTIONS } from "../data/factions";
import { reachableThrough } from "./mapGraph";
import { isFriendlyOwner } from "./relations";
import type { GameState } from "../state/types";

export function suppliedProvinces(state: GameState, factionId: string): Set<string> {
  const def = FACTIONS[factionId as keyof typeof FACTIONS];
  if (!def) return new Set();
  const capital = def.capitalProvinceId;
  // 首都已陷时以任一己方省份为源（残部补给）
  const startOwned = state.provinces[capital]?.ownerId === factionId
    ? capital
    : Object.values(state.provinces).find((p) => p.ownerId === factionId)?.id;
  if (!startOwned) return new Set();
  return reachableThrough(startOwned, (pid) => {
    const owner = state.provinces[pid]?.ownerId ?? "neutral";
    return isFriendlyOwner(state, factionId, owner);
  });
}
