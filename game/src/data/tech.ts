// 科技树简表（M1）：6 个分支各 3 级。研究点来自民用工厂（月产 = 民用工厂数 x researchPerCivFactory），
// SET_RESEARCH 选定当前分支，点数攒够 cost 自动升级。效果走乘区参数（结算/战斗读取）。

export type TechBranch = "infantry" | "artillery" | "armor" | "air" | "navy" | "industry";

export interface TechLevelDef {
  level: number; // 1-3
  name: string;
  cost: number; // 研究点
}

export interface TechBranchDef {
  id: TechBranch;
  name: string;
  levels: TechLevelDef[];
  // 每级乘区效果（战斗/生产结算读取，level 0 = 无加成）
  effectPerLevel: number;
  effectDesc: string;
}

export const RESEARCH_PER_CIV_FACTORY = 2;

export const TECH_BRANCHES: Record<TechBranch, TechBranchDef> = {
  infantry: {
    id: "infantry", name: "步兵装备", effectPerLevel: 0.08, effectDesc: "步兵/山地/守备类攻防 +8%/级",
    levels: [
      { level: 1, name: "步兵武器 I", cost: 30 },
      { level: 2, name: "步兵武器 II", cost: 60 },
      { level: 3, name: "步兵武器 III", cost: 100 },
    ],
  },
  artillery: {
    id: "artillery", name: "火炮", effectPerLevel: 0.07, effectDesc: "全师攻击 +7%/级（火力支援）",
    levels: [
      { level: 1, name: "火炮 I", cost: 30 },
      { level: 2, name: "火炮 II", cost: 60 },
      { level: 3, name: "火炮 III", cost: 100 },
    ],
  },
  armor: {
    id: "armor", name: "装甲", effectPerLevel: 0.1, effectDesc: "装甲/摩托化攻防 +10%/级",
    levels: [
      { level: 1, name: "装甲 I", cost: 40 },
      { level: 2, name: "装甲 II", cost: 70 },
      { level: 3, name: "装甲 III", cost: 110 },
    ],
  },
  air: {
    id: "air", name: "航空", effectPerLevel: 0.1, effectDesc: "空军支援效果 +10%/级",
    levels: [
      { level: 1, name: "航空 I", cost: 40 },
      { level: 2, name: "航空 II", cost: 70 },
      { level: 3, name: "航空 III", cost: 110 },
    ],
  },
  navy: {
    id: "navy", name: "海军", effectPerLevel: 0.1, effectDesc: "舰队支援与两栖 +10%/级",
    levels: [
      { level: 1, name: "海军 I", cost: 40 },
      { level: 2, name: "海军 II", cost: 70 },
      { level: 3, name: "海军 III", cost: 110 },
    ],
  },
  industry: {
    id: "industry", name: "工业", effectPerLevel: 0.1, effectDesc: "装备产出 +10%/级",
    levels: [
      { level: 1, name: "工业 I", cost: 30 },
      { level: 2, name: "工业 II", cost: 60 },
      { level: 3, name: "工业 III", cost: 100 },
    ],
  },
};

export const TECH_BRANCH_IDS = Object.keys(TECH_BRANCHES) as TechBranch[];
