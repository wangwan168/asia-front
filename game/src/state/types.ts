// 游戏状态类型（M2 完整版）。状态只经 applyAction 变更；本文件只定义形状，不含逻辑。
// 胜利口径（用户 2026-11-16 02:10 亲定）：统一胜利——控制 >=70% 省份（附庸省份计入宗主），
// 或其余势力全灭/全附庸；失去全部省份且无部队 = 出局。无回合上限（见 data/timeline.ts）。
// 玩家势力是开局参数（playerFactionId），禁止硬编码。

import type { BlocId } from "../data/factions";
import type { TechBranch } from "../data/tech";

export const STATE_VERSION = 7;

export interface ChronicleEntry {
  turn: number;
  year: number;
  month: number;
  kind: string; // "system" | "event" | "battle" | "diplomacy" | "economy"
  text: string;
}

export interface StockpileState {
  equipment: number;
  manpower: number;
  oil: number;
  steel: number;
  rubber: number;
  food: number;
}

export interface FactionState {
  id: string;
  active: boolean; // 事件生成势力未激活前为 false
  alive: boolean; // 出局（无省份且无部队）为 false
  bloc: BlocId;
  stockpile: StockpileState;
  stability: number; // 0-100
  warSupport: number; // 0-100
  tech: Record<TechBranch, number>;
  researchBranch: TechBranch | null;
  researchPoints: number;
  focusId: string | null;
  focusMonthsLeft: number;
  completedFocuses: string[];
  vassalOf: string | null; // 宗主 factionId
  constructionPoints: number;
}

export interface ProvinceState {
  id: string;
  ownerId: string; // FactionId | "neutral"
  factoriesMil: number;
  factoriesCiv: number;
  damagedMonths: number; // 工业受损剩余月数（游击袭扰 raidIndustry 打出）：>0 时本省工业产出减半
}

export interface DivisionState {
  id: string;
  factionId: string;
  templateId: string;
  provinceId: string;
  strength: number; // 当前实际人数
  movedTurn: number; // 上次移动/攻击的回合（每回合限一次行动）
  staticMonths: number; // 静止驻扎月数：筹备攻势/坚守筑垒共用层数来源（移动/进攻/受击清零）
  org: number; // 组织度 0-100（钢4 organization 月尺度版）：进攻/行军消耗、驻扎恢复；v3 存档迁移补 100
  groupId?: string | null; // 所属常设编组（指挥工具，无数值加成）；旧存档缺省 = 无编组
  pathIds?: string[]; // 未走完的行军路径（剩余省份序列）；走不完下月 END_TURN 自动续走
}

export interface ArmyGroupState {
  id: string;
  factionId: string;
  name: string; // 成员 = divisions 中 groupId === id 者（单一事实源在部队侧）
}

export type SupportKind = "fighter" | "bomber" | "fleet";

/** 登陆作战计划（三期项目制）：筹备月锁定参战师，readyTurn 当月可执行，过期作废。 */
export interface LandingPlanState {
  id: string;
  factionId: string;
  divisionIds: string[];
  fromProvinceId: string;
  targetProvinceId: string;
  readyTurn: number;
}

export interface SupportState {
  id: string;
  factionId: string;
  kind: SupportKind;
  provinceId: string;
  missionTargetId: string; // 空军/舰队任务目标省（二期任务系统）；缺省 = 驻扎省。旧存档迁移补驻扎省
}

export interface ProductionItemState {
  id: string;
  factionId: string;
  kind: "division" | "factoryMil" | "factoryCiv" | "support";
  templateId: string | null;
  supportKind: SupportKind | null;
  provinceId: string;
  monthsLeft: number;
}

export interface GameOverState {
  winnerId: string | null;
  reason: string;
}

/** 战斗标记种类：battle 交战 / encircle 包围 / landing 登陆 / airraid 空袭 / decisive 大捷 / raid 游击袭击 */
export type CombatMarkKind = "battle" | "encircle" | "landing" | "airraid" | "decisive" | "raid";

export interface CombatMark {
  provinceId: string;
  kind: CombatMarkKind;
  turn: number; // 战斗发生的回合（END_TURN 时清除 turn < 当前回合的旧标记）
}

export interface GameState {
  version: number;
  seed: number;
  turn: number; // 从 1 开始，回合 1 = 1936 年 1 月；无上限
  year: number;
  month: number;
  playerFactionId: string | null; // 开局所选国家（默认国民政府仅为默认值，非锁定）
  difficulty: string;
  factions: Record<string, FactionState>;
  provinces: Record<string, ProvinceState>;
  divisions: DivisionState[];
  groups: ArmyGroupState[]; // 常设编组（军/集团军）；旧存档迁移时缺省 []
  combatMarks: CombatMark[];
  landingPlans: LandingPlanState[]; // 三期：登陆作战计划（仅发起方 UI 可见） // 本月/上月战斗标记（C5 地图标记数据源）；旧存档迁移时缺省 []
  supports: SupportState[];
  production: ProductionItemState[];
  relations: Record<string, number>; // pairKey -> 0-100
  wars: string[]; // pairKey 列表
  alliances: string[]; // pairKey 列表
  tradePacts: string[]; // pairKey 列表
  nonAggression: string[]; // pairKey 列表
  diplomacyCooldowns: Record<string, number>; // `${actor}|${target}|${actionId}` -> 可用回合
  firedEvents: string[];
  gameOver: GameOverState | null;
  nextId: number;
  log: ChronicleEntry[];
}
