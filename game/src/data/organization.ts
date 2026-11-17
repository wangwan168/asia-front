// 组织度（钢4 organization 的月尺度版）：师级「体力条」，与兵力（人数）分开。
// 进攻/行军消耗，驻扎且补给良好时恢复；断补给/恶劣地形恢复慢。组织度过低战力显著下降，
// 低于 ORG_MIN_ATTACK 不得下进攻令，战斗中前线组织度崩溃会被迫停攻。
// 恢复走月结算（settlement），消耗走战斗/行军（combat/movement），面板可见。

export const ORG_MAX = 100;
export const ORG_MIN_ATTACK = 20; // 低于此不得进攻
export const ORG_FORCED_STOP = 15; // 战斗中前线平均组织度低于此：被迫停攻
export const ORG_ATTACK_COST_PER_PHASE = 6; // 主攻师每战斗阶段消耗（一场最多 3 阶段 = 18）
export const ORG_SUPPORT_COST_PER_PHASE = 4; // 支援进攻师每阶段消耗
export const ORG_MOVE_COST_PER_PROVINCE = 3; // 行军每进入一省消耗
export const ORG_MOVE_FLOOR = 5; // 行军不会把组织度耗到 5 以下
export const ORG_RECOVERY_BASE = 25; // 每月恢复基数（未行动、补给连通、地形乘子另计）
export const ORG_RECOVERY_UNSUPPLIED_MULT = 0.25;

/** 组织度战力系数：100 -> 1.0，0 -> 0.5（线性）。 */
export function orgPowerFactor(org: number): number {
  const o = Math.max(0, Math.min(ORG_MAX, org));
  return 0.5 + 0.5 * (o / ORG_MAX);
}

/** 多方向合击的包抄压力：按参战出发省数量（主攻+支援）给攻方乘子。 */
export const DIRECTION_BONUS: Record<number, number> = { 1: 1, 2: 1.1, 3: 1.2 };
export const DIRECTION_BONUS_MAX = 1.2;

export function directionBonus(originCount: number): number {
  return DIRECTION_BONUS[originCount] ?? DIRECTION_BONUS_MAX;
}
