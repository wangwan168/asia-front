// 胜负判定（用户 2026-11-16 02:10 亲定，统一口径）：
// 胜 = 控制 >=70% 省份（附庸省份计入宗主），或其余存活势力全为自己的附庸/已出局；
// 败 = 失去全部省份且无部队（出局，见 settlement）。无回合上限：未分胜负就一直打。

import { FACTIONS } from "../data/factions";
import { controlledProvinceCount } from "./relations";
import { pushLog } from "./relations";
import type { GameState } from "../state/types";

export const VICTORY_PROVINCE_SHARE = 0.7;

export function checkVictory(draft: GameState): void {
  if (draft.gameOver) return;
  const total = Object.keys(draft.provinces).length;
  const threshold = Math.ceil(total * VICTORY_PROVINCE_SHARE);
  const aliveActive = Object.values(draft.factions).filter((f) => f.active && f.alive);

  for (const f of aliveActive) {
    if (controlledProvinceCount(draft, f.id) >= threshold) {
      draft.gameOver = {
        winnerId: f.id,
        reason: `${FACTIONS[f.id as keyof typeof FACTIONS]?.name ?? f.id} 控制了 ${controlledProvinceCount(draft, f.id)}/${total} 个省份（>=70%），赢得亚洲战场。`,
      };
      pushLog(draft, "system", draft.gameOver.reason);
      return;
    }
  }
  // 其余全灭/全附庸
  for (const f of aliveActive) {
    if (f.vassalOf) continue;
    const others = aliveActive.filter((o) => o.id !== f.id);
    if (others.every((o) => o.vassalOf === f.id)) {
      draft.gameOver = {
        winnerId: f.id,
        reason: `${FACTIONS[f.id as keyof typeof FACTIONS]?.name ?? f.id} 使其余势力全灭或臣服，赢得亚洲战场。`,
      };
      pushLog(draft, "system", draft.gameOver.reason);
      return;
    }
  }
  // 玩家出局
  const player = draft.playerFactionId ? draft.factions[draft.playerFactionId] : undefined;
  if (player && player.active && !player.alive) {
    let best: string | null = null;
    let bestCount = -1;
    for (const f of aliveActive) {
      const c = controlledProvinceCount(draft, f.id);
      if (c > bestCount) {
        bestCount = c;
        best = f.id;
      }
    }
    draft.gameOver = {
      winnerId: best,
      reason: `你扮演的势力已经出局。当前最强势力：${best ? (FACTIONS[best as keyof typeof FACTIONS]?.name ?? best) : "无"}（控制 ${bestCount} 省）。`,
    };
    pushLog(draft, "system", draft.gameOver.reason);
  }
}
