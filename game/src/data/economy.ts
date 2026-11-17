// 经济参数（M1）：四资源（装备由工业产出、人力、油/钢/橡胶/粮以库存点计）月结算口径。
// 工厂分军工（产装备点）/民用（产建设点，建设点用于建厂）；省份 industry 拆军民按 milShare。
// 难度倍率沿用大清口径：只对非玩家势力统一生效，普通 = 1.0，玩家恒 1.0。

export const ECONOMY = {
  equipmentPerMilFactory: 10, // 每军工厂月产装备点（再乘工业科技与稳定度系数）
  constructionPerCivFactory: 5, // 每民用工厂月产建设点
  factoryBuildCost: 60, // 建一座工厂的建设点
  factoryBuildMonths: 3, // 建厂工期（月）
  steelPerMilFactory: 1, // 每军工厂月耗钢（不足时产出按比例打折）
  manpowerGrowthRate: 0.004, // 人力池月增长 = 省份 manpower 总和 x 本率
  stabilityProductionPivot: 50, // 稳定度对产出系数 = 0.7 + stability/200（50 时为 0.95）
  unsuppliedStrengthDecay: 0.05, // 无补给省份部队月衰减（游击单位减半）
  shortageStabilityPenalty: 3, // 粮食耗尽时稳定度月降
  replenishEquipmentRatio: 0.1, // 补员：每补 1 人耗装备点 = 模板 equipmentCost/fullStrength x 本系数修正（约等于按比例）
} as const;

export type DifficultyId = "easy" | "normal" | "hard";

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  aiMult: number; // 仅非玩家势力：产出/补给收入统一倍率，玩家恒 1.0
}

export const DIFFICULTY: DifficultyDef[] = [
  { id: "easy", name: "简单", aiMult: 0.85 },
  { id: "normal", name: "普通", aiMult: 1.0 },
  { id: "hard", name: "困难", aiMult: 1.2 },
];
export const DEFAULT_DIFFICULTY: DifficultyId = "normal";
