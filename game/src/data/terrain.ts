// 地形系统参数表（钢4 式，月回合/师级/省份尺度落地）：战斗/行军/补给/容量/筑垒/恢复共用一表。
// 参考钢4：地形给守方防御与进攻惩罚、按兵种（装甲/摩托化/山地/丛林）适配、补给损耗与行军速度；
// 取舍：不做逐营战斗宽度（以「省份容量=有效参战师数」替代）、不做逐小时天气（季节修正留口未启用）。
// 省份特征（port/island/coastal/capital）不是地形：port/island 在 ProvinceDef 标记，
// coastal 由「有跨海边或港口/岛屿」推导，capital 由势力首都省推导。

import type { Terrain } from "./provinces";

export interface TerrainParam {
  name: string;
  defMult: number; // 守方地形防御乘子（城市旧 +15% 已并入 urban，不再另叠）
  moveCost: number; // 进入该省的基础移动点成本（步兵基准）
  capacity: number; // 省份容量：有效参战师数（超出按比例递减效率，双方同算）
  unsuppliedMult: number; // 断补给月衰减倍率（基数 ECONOMY.unsuppliedStrengthDecay）
  suppliedAttrition: number; // 有补给时月损耗（丛林疾病/沙漠/沼泽/高山环境）
  fortGrowMult: number; // 筑垒/筹备层数增速
  fortCapMult: number; // 筑垒层数上限倍率（乘 combatSystems.FORTIFY.maxLayers）
  recoveryMult: number; // 驻扎补员速度乘子
  color: string; // 地形地图模式底色
  // T2 留口（只存数据、本批不启用）：季节修正（冬季严寒/雨季泥泞/季风），按月作用于区域。
  seasonal?: { winter?: number; monsoon?: number };
}

export const TERRAIN_PARAMS: Record<Terrain, TerrainParam> = {
  plains: {
    name: "平原", defMult: 1.0, moveCost: 2, capacity: 8, unsuppliedMult: 1.0,
    suppliedAttrition: 0, fortGrowMult: 0.6, fortCapMult: 0.8, recoveryMult: 1.1, color: "#b8a86b",
  },
  forest: {
    name: "森林", defMult: 1.15, moveCost: 3, capacity: 6, unsuppliedMult: 1.2,
    suppliedAttrition: 0, fortGrowMult: 0.9, fortCapMult: 1.0, recoveryMult: 0.9, color: "#4d6b35",
    seasonal: { winter: 1.1 },
  },
  hills: {
    name: "丘陵", defMult: 1.25, moveCost: 4, capacity: 5, unsuppliedMult: 1.2,
    suppliedAttrition: 0, fortGrowMult: 1.2, fortCapMult: 1.15, recoveryMult: 0.9, color: "#8a7a4a",
  },
  mountain: {
    name: "山地", defMult: 1.45, moveCost: 7, capacity: 3, unsuppliedMult: 1.6,
    suppliedAttrition: 0.005, fortGrowMult: 1.5, fortCapMult: 1.35, recoveryMult: 0.8, color: "#7a6a58",
    seasonal: { winter: 1.2 },
  },
  jungle: {
    name: "丛林", defMult: 1.3, moveCost: 5, capacity: 4, unsuppliedMult: 1.8,
    suppliedAttrition: 0.01, fortGrowMult: 0.9, fortCapMult: 1.0, recoveryMult: 0.6, color: "#2e5d33",
    seasonal: { monsoon: 1.2 },
  },
  desert: {
    name: "沙漠", defMult: 1.0, moveCost: 4, capacity: 6, unsuppliedMult: 1.7,
    suppliedAttrition: 0.008, fortGrowMult: 0.7, fortCapMult: 0.85, recoveryMult: 0.7, color: "#d3b878",
  },
  marsh: {
    name: "沼泽", defMult: 1.2, moveCost: 5, capacity: 4, unsuppliedMult: 1.8,
    suppliedAttrition: 0.01, fortGrowMult: 0.8, fortCapMult: 0.9, recoveryMult: 0.6, color: "#5d7263",
    seasonal: { monsoon: 1.15 },
  },
  urban: {
    name: "城市", defMult: 1.3, moveCost: 3, capacity: 5, unsuppliedMult: 0.9,
    suppliedAttrition: 0, fortGrowMult: 1.3, fortCapMult: 1.2, recoveryMult: 1.2, color: "#8d8578",
  },
};

/** 兵种大类（模板 cls）×地形的默认攻防乘子：模板自带 terrainMods 优先，未列才用此表兜底。 */
export const CLS_TERRAIN_DEFAULTS: Partial<Record<Terrain, Record<string, number>>> = {
  mountain: { armor: 0.55, motorized: 0.65, cavalry: 0.8 },
  jungle: { armor: 0.6, motorized: 0.7, cavalry: 0.75 },
  marsh: { armor: 0.55, motorized: 0.6, cavalry: 0.7, infantry: 0.9 },
  urban: { armor: 0.75, cavalry: 0.8 },
  forest: { armor: 0.8, motorized: 0.85 },
  hills: { armor: 0.8, motorized: 0.85 },
};

/** 兵种大类 ×地形的行军成本系数（乘基础 moveCost）。 */
export const CLS_MOVE_FACTOR: Record<string, Partial<Record<Terrain, number>>> = {
  armor: { mountain: 1.4, jungle: 1.3, marsh: 1.4, forest: 1.15 },
  motorized: { mountain: 1.4, jungle: 1.3, marsh: 1.4, forest: 1.15 },
  cavalry: { mountain: 1.2, jungle: 1.2, marsh: 1.3, plains: 0.9 },
  mountain: { mountain: 0.55, hills: 0.75, jungle: 0.85 },
  guerrilla: { jungle: 0.6, marsh: 0.6, mountain: 0.7, forest: 0.8 },
  marine: { marsh: 0.7, jungle: 0.85 },
};

/** 省份特征修正（非地形）：港口守方防御、陆战队对港口/岛屿目标的适配。 */
export const PORT_DEF_MULT = 1.1;
export const MARINE_FEATURE_MULT = 1.2;

/** 行军：渡河额外成本（与渡河战斗惩罚 RIVER_ATK_MULT 分开）、跨海航线固定成本。 */
export const RIVER_MOVE_COST = 2;
export const SEA_MOVE_COST = 3;

/** 容量递减：超出容量的师，每师只发挥此比例效率。 */
export const OVERFLOW_EFFICIENCY = 0.4;

export function capacityFactor(count: number, capacity: number): number {
  if (count <= capacity) return 1;
  return (capacity + (count - capacity) * OVERFLOW_EFFICIENCY) / count;
}
