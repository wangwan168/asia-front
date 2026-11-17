// 外交（M1）：沿用大清七项判定骨架、二战口径命名。判定与 llm 无关（没接 AI 也完整可用）。
// 关系 0-100 五档沿用；称臣改「附庸」口径（附庸方每月向宗主缴资源、宗主胜负统计计入其省份）。

export interface RelationTier {
  id: string;
  name: string;
  min: number;
  max: number;
}

export const RELATION_TIERS: RelationTier[] = [
  { id: "hostile", name: "敌视", min: 0, max: 14 },
  { id: "strained", name: "嫌隙", min: 15, max: 39 },
  { id: "neutral", name: "中立", min: 40, max: 64 },
  { id: "friendly", name: "亲善", min: 65, max: 84 },
  { id: "allied", name: "同盟", min: 85, max: 100 },
];

export function relationTierOf(value: number): RelationTier {
  return RELATION_TIERS.find((t) => value >= t.min && value <= t.max) ?? RELATION_TIERS[2]!;
}

export type DiplomacyActionId =
  | "envoy" | "trade" | "alliance" | "nonAggression" | "vassalize" | "peace" | "declareWar";

export interface DiplomacyActionDef {
  id: DiplomacyActionId;
  name: string;
  costEquipment: number; // 以装备点计的外交成本（军援/礼物）
  relationDelta: number;
  relationSetTo: number | null;
  requiresMinRelation: number;
}

export const DIPLOMACY_ACTIONS: DiplomacyActionDef[] = [
  { id: "envoy", name: "改善关系", costEquipment: 10, relationDelta: 8, relationSetTo: null, requiresMinRelation: 0 },
  { id: "trade", name: "贸易协定", costEquipment: 15, relationDelta: 5, relationSetTo: null, requiresMinRelation: 40 },
  { id: "alliance", name: "军事同盟", costEquipment: 20, relationDelta: 15, relationSetTo: null, requiresMinRelation: 65 },
  { id: "nonAggression", name: "互不侵犯条约", costEquipment: 0, relationDelta: 10, relationSetTo: null, requiresMinRelation: 30 },
  { id: "vassalize", name: "收为附庸", costEquipment: 30, relationDelta: 10, relationSetTo: null, requiresMinRelation: 60 },
  { id: "peace", name: "停战议和", costEquipment: 25, relationDelta: 10, relationSetTo: null, requiresMinRelation: 0 },
  { id: "declareWar", name: "宣战", costEquipment: 0, relationDelta: 0, relationSetTo: 0, requiresMinRelation: 0 },
];

export const DIPLOMACY_RUNTIME = {
  cooldownTurns: 3, // 同一（发起方, 目标, 行动）冷却月数
  vassalMonthlyTribute: { equipment: 5, food: 20 }, // 附庸每月向宗主缴纳
  tradeMonthlyGain: { equipment: 4, steel: 6 }, // 贸易协定双方每月收益（协定存续期间）
} as const;

// 初始关系（1936 年 1 月口径，未列 = 50 中立）
export const INITIAL_RELATIONS: Record<string, number> = {
  "ccp__roc": 25, // 国共对峙（西安事变前）
  "japan__roc": 20,
  "japan__ccp": 10,
  "japan__manchukuo": 90,
  "japan__mengjiang": 75,
  "japan__ussr": 35,
  "mongolia__ussr": 90,
  "japan__usa": 45,
  "japan__uk": 45,
  "roc__ussr": 45,
  "ccp__ussr": 70,
  "roc__warlords": 55,
  "ccp__warlords": 35,
  "japan__warlords": 40,
  "france__uk": 70,
  "netherlands__uk": 70,
  "uk__usa": 75,
  "france__usa": 65,
  "netherlands__usa": 65,
  "thailand__uk": 45,
  "japan__thailand": 55,
  "philippines__usa": 85,
  "japan__philippines": 35,
  "roc__usa": 60,
  "roc__uk": 55,
};

export function relationPairKey(a: string, b: string): string {
  return [a, b].sort().join("__");
}

export function initialRelation(a: string, b: string): number {
  return INITIAL_RELATIONS[relationPairKey(a, b)] ?? 50;
}
