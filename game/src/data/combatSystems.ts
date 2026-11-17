// 战斗系统参数总表（攻击玩法重做，设计稿 docs/combat-gameplay-redesign.md）：
// 旧 attackModes.ts 的 8 个「模式开关」拆回系统——差异来自部队构成/筹备/补给/地形/
// 空海军任务，全在下令之前决定；ATTACK 只有一个动作，结算只读本表做通用计算，
// 不按系统名特判。参考钢4：计划加成、筑垒、包围歼灭、空优三档＋CAS、登陆制海＋舰炮、
// 渗透编制、突破矛头；舍：战斗宽度、逐营属性、将领技能树（见设计稿 §参考/取舍）。

export interface TierMult {
  friendly: number;
  contested: number;
  enemy: number;
}

/** §1 默认进攻基准（原 frontal_assault 乘区升格，保持现行手感）。 */
export const BASE_ATTACK = { attackMult: 1.15, attackerLossMult: 1.2, defenderLossMult: 1.1 };

/** §2 计划（筹备攻势）：参战师 staticMonths 兵力加权层数换进攻乘区，进攻后清零。 */
export const PLAN = { perLayer: 0.12, maxLayers: 3 };

/** §3 筑垒（坚守）：守方 staticMonths 层数换防御乘区（上限再乘地形 fortCapMult）。 */
export const FORTIFY = { perLayer: 0.12, maxLayers: 3 };

/** §4 包围：目标省不在守方补给网内 → 守方战力乘子，且攻方获胜时守军就地歼灭。 */
export const ENCIRCLEMENT = { unsuppliedDefMult: 0.5, destroyOnWin: true };

/** §5 渗透：特性师兵力占比 ≥ minShare 且目标地形命中 → 守方地形防御减半、自损替换值。 */
export const INFILTRATION = {
  terrains: ["mountain", "jungle"] as const,
  defTerrainMult: 0.5,
  attackerLossMult: 1.2,
  minShare: 0.5,
};

/** §6 空军（任务系统在二期；一期沿用在场口径）：空优三档＋CAS 对地支援。 */
export const AIR = {
  tierMult: { friendly: 1.25, contested: 1.0, enemy: 0.8 } as TierMult,
  casMult: 1.15,
  casDefLossMult: 1.15,
};

/** §9 登陆：一期跨海进攻自动按此结算（港口出发）；三期改项目制（筹备/执行）。 */
export const LANDING = {
  prepMonths: 1,
  attackMult: 0.85,
  attackerLossMult: 1.3,
  defenderLossMult: 1.0,
  seaTierMult: { friendly: 1.15, contested: 1.0, enemy: 0.75 } as TierMult,
  fleetGunsMult: 1.15,
};

/** §7 突破追击（三期）。 */
export const PURSUIT = {
  minRatio: 2.2,
  minOrg: 30,
  orgCost: 25,
  weakDefRatio: 0.25,
  clashLossScale: 0.5,
  classes: ["armor", "motorized", "cavalry"] as const,
};

/** §8 矛头：ATTACK 可指定 ≤2 个参战师为矛头——战力/战损/组织消耗齐涨，胜时优先进驻。 */
export const SPEARHEAD = { maxCount: 2, powerMult: 1.35, lossMult: 1.5, orgCostMult: 1.5 };

/** §10 游击袭扰（独立 RAID 动作）：成功率/工业受损/驻军扰动参数。 */
export const RAID = {
  successBase: 0.8,
  successDense: 0.45,
  denseDefenders: 2,
  damagedMonths: 2,
  denseDamagedMonths: 1,
  garrisonLossRate: 0.05,
  failLossRate: 0.1,
};
