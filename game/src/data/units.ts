// 师级模板（M1）：满编人数 = 实际人数（步兵师约万人）。装备需求/工业造价以「装备点」统一计价
// （建造时从装备库存支付、编成时间 buildMonths），月补给消耗 food/oil 点。
// 地形修正 terrainMods：该模板在对应地形的攻防乘子（未列 = 1.0）。
// 克制简表 counters：对某类模板的攻击乘子（装甲克步兵、步兵在城/山克装甲等，数值同档小幅）。

export type TemplateClass = "infantry" | "mountain" | "cavalry" | "motorized" | "armor" | "marine" | "garrison" | "guerrilla";

export interface DivisionTemplate {
  id: string;
  name: string;
  cls: TemplateClass;
  factionId: string | null; // 特色师专属势力，null = 通用
  fullStrength: number; // 满编实际人数
  equipmentCost: number; // 装备点
  buildMonths: number; // 编成时间（月）
  supplyFood: number; // 月补给：粮
  supplyOil: number; // 月补给：油
  attack: number;
  defense: number;
  speed: number; // 每回合可移动的六角距离（经相邻省份逐格）
  terrainMods: Partial<Record<string, number>>; // 地形 -> 攻防综合乘子
  counters: Partial<Record<TemplateClass, number>>; // 对某类模板攻击乘子
  guerrilla: boolean; // 游击类：可驻扎敌控省份、无补给线时衰减减半
  infiltration: boolean; // 渗透特性：特性师兵力占比过半且山地/丛林时守方地形优势减半（combatSystems.INFILTRATION）
}

function t(def: Partial<DivisionTemplate> & Pick<DivisionTemplate, "id" | "name" | "cls">): DivisionTemplate {
  return {
    factionId: null, fullStrength: 10000, equipmentCost: 100, buildMonths: 3,
    supplyFood: 3, supplyOil: 0, attack: 10, defense: 12, speed: 2,
    terrainMods: {}, counters: {}, guerrilla: false, infiltration: false, ...def,
  } as DivisionTemplate;
}

export const TEMPLATES: Record<string, DivisionTemplate> = {
  infantry: t({ id: "infantry", name: "步兵师", cls: "infantry" }),
  mountain: t({
    id: "mountain", name: "山地师", cls: "mountain", fullStrength: 8000, equipmentCost: 90,
    attack: 9, defense: 13, terrainMods: { mountain: 1.3, jungle: 1.2 }, infiltration: true,
  }),
  cavalry: t({
    id: "cavalry", name: "骑兵师", cls: "cavalry", fullStrength: 6000, equipmentCost: 80,
    attack: 9, defense: 8, speed: 4, terrainMods: { plains: 1.15, mountain: 0.7, jungle: 0.7 },
    counters: { infantry: 1.1 }, infiltration: true,
  }),
  motorized: t({
    id: "motorized", name: "摩托化师", cls: "motorized", fullStrength: 9000, equipmentCost: 160,
    buildMonths: 4, supplyOil: 2, attack: 13, defense: 11, speed: 5,
    terrainMods: { plains: 1.2, mountain: 0.7, jungle: 0.75 }, counters: { infantry: 1.15 },
  }),
  armor: t({
    id: "armor", name: "装甲师", cls: "armor", fullStrength: 8000, equipmentCost: 240,
    buildMonths: 5, supplyFood: 3, supplyOil: 3, attack: 18, defense: 14, speed: 5,
    terrainMods: { plains: 1.3, mountain: 0.6, jungle: 0.65, urban: 0.8 },
    counters: { infantry: 1.25, garrison: 1.25, cavalry: 1.2 },
  }),
  marine: t({
    id: "marine", name: "海军陆战队", cls: "marine", fullStrength: 9000, equipmentCost: 120,
    buildMonths: 4, attack: 12, defense: 11, terrainMods: {}, // 港口/岛屿适配走特征修正（terrain.ts MARINE_FEATURE_MULT）
  }),
  garrison: t({
    id: "garrison", name: "驻屯守备队", cls: "garrison", fullStrength: 5000, equipmentCost: 50,
    buildMonths: 2, supplyFood: 2, attack: 5, defense: 10, speed: 1,
  }),
  guerrilla: t({
    id: "guerrilla", name: "游击队", cls: "guerrilla", fullStrength: 3000, equipmentCost: 30,
    buildMonths: 1, supplyFood: 1, attack: 6, defense: 9, speed: 3, guerrilla: true, infiltration: true,
    terrainMods: { jungle: 1.35, mountain: 1.3, plains: 0.8 },
  }),
  // ---- 特色师（数值同档、风味不同） ----
  germanTrained: t({ id: "germanTrained", name: "德械师（中央军）", cls: "infantry", factionId: "roc", equipmentCost: 130, attack: 12, defense: 13 }),
  eighthRoute: t({
    id: "eighthRoute", name: "八路军主力团（师级）", cls: "guerrilla", factionId: "ccp",
    fullStrength: 8000, equipmentCost: 55, buildMonths: 2, supplyFood: 2, attack: 8, defense: 11,
    guerrilla: true, infiltration: true, terrainMods: { mountain: 1.35, jungle: 1.2, plains: 0.85 },
  }),
  kwantung: t({ id: "kwantung", name: "关东军师团", cls: "infantry", factionId: "japan", equipmentCost: 120, attack: 13, defense: 13 }),
  infantry_jp: t({ id: "infantry_jp", name: "日本步兵师团", cls: "infantry", factionId: "japan", equipmentCost: 110, attack: 12, defense: 12, terrainMods: { jungle: 1.1 }, infiltration: true }),
  marine_jp: t({ id: "marine_jp", name: "海军特别陆战队", cls: "marine", factionId: "japan", equipmentCost: 120, attack: 12, defense: 11, terrainMods: {}, infiltration: true }),
  farEast: t({ id: "farEast", name: "苏军远东师", cls: "infantry", factionId: "ussr", equipmentCost: 120, attack: 12, defense: 13, terrainMods: { plains: 1.1 } }),
  marine_us: t({ id: "marine_us", name: "美军陆战师", cls: "marine", factionId: "usa", equipmentCost: 150, attack: 14, defense: 12, terrainMods: {} }),
  gurkha: t({ id: "gurkha", name: "廓尔喀山地旅（师级）", cls: "mountain", factionId: "uk", fullStrength: 8000, equipmentCost: 100, attack: 11, defense: 13, terrainMods: { mountain: 1.35, jungle: 1.25 } }),
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES);

// 支援单位（空军联队/舰队抽象单位）：驻扎省份、给本方战斗加成，不占师编制
export interface SupportDef {
  kind: "fighter" | "bomber" | "fleet";
  name: string;
  equipmentCost: number;
  buildMonths: number;
  supplyOil: number;
}

export const SUPPORTS: Record<"fighter" | "bomber" | "fleet", SupportDef> = {
  fighter: { kind: "fighter", name: "战斗机联队", equipmentCost: 150, buildMonths: 4, supplyOil: 2 },
  bomber: { kind: "bomber", name: "轰炸机联队", equipmentCost: 180, buildMonths: 4, supplyOil: 2 },
  fleet: { kind: "fleet", name: "舰队", equipmentCost: 300, buildMonths: 8, supplyOil: 4 },
};
