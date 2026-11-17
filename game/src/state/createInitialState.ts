// 初始状态组装（纯函数）：从 src/data 的势力/省份/外交定义组装 1936 年 1 月开局。
// 玩家任选 18 家之一（默认国民政府只是默认值）；事件生成势力未激活，
// 但玩家若选了它则按 spawn 口径提前激活（what-if，汪伪另含南京/上海/杭州移交）。

import { TIMELINE } from "../data/timeline";
import { FACTIONS, FACTION_IDS, DEFAULT_PLAYER_FACTION } from "../data/factions";
import { PROVINCES } from "../data/provinces";
import { TEMPLATES } from "../data/units";
import { initialRelation, relationPairKey } from "../data/diplomacy";
import { TECH_BRANCH_IDS } from "../data/tech";
import { DEFAULT_DIFFICULTY } from "../data/economy";
import { hashSeed, type SeedInput } from "../core/rng";
import {
  STATE_VERSION,
  type DivisionState,
  type FactionState,
  type GameState,
  type ProvinceState,
  type SupportState,
} from "./types";

export interface CreateInitialStateOptions {
  seed?: SeedInput;
  playerFactionId?: string | null; // 缺省 = 国民政府（默认高亮项，非锁定）
  difficulty?: string;
}

export function createInitialState(options: CreateInitialStateOptions = {}): GameState {
  const seed = typeof options.seed === "string" ? hashSeed(options.seed) : (options.seed ?? 1);
  const playerFactionId = options.playerFactionId ?? DEFAULT_PLAYER_FACTION;
  let nextId = 1;
  const nid = (prefix: string): string => `${prefix}-${nextId++}`;

  const factions: Record<string, FactionState> = {};
  for (const fid of FACTION_IDS) {
    const def = FACTIONS[fid];
    const active = def.startsActive || fid === playerFactionId;
    factions[fid] = {
      id: fid,
      active,
      alive: active,
      bloc: def.bloc,
      stockpile: { ...def.initialStockpile },
      stability: 55,
      warSupport: 40,
      tech: Object.fromEntries(TECH_BRANCH_IDS.map((b) => [b, 0])) as FactionState["tech"],
      researchBranch: null,
      researchPoints: 0,
      focusId: null,
      focusMonthsLeft: 0,
      completedFocuses: [],
      vassalOf: null,
      constructionPoints: 0,
    };
  }

  const provinces: Record<string, ProvinceState> = {};
  for (const def of PROVINCES) {
    const mil = Math.round(def.industry * def.milShare);
    provinces[def.id] = {
      id: def.id,
      ownerId: def.ownerId,
      factoriesMil: mil,
      damagedMonths: 0,
      factoriesCiv: def.industry - mil,
    };
  }

  // 玩家选择汪伪（事件势力）时提前激活：南京/上海/杭州自国民政府移交（what-if 口径）
  if (playerFactionId === "wangjingwei") {
    for (const pid of ["nanjing", "shanghai", "hangzhou"]) {
      if (provinces[pid]) provinces[pid].ownerId = "wangjingwei";
    }
  }
  // 玩家选择蒙疆（1939 事件生成势力）时提前激活：察哈尔/绥远本部自地方军阀移交（what-if 口径）
  if (playerFactionId === "mengjiang") {
    for (const pid of ["hohhot", "baotou", "zhangjiakou", "duolun"]) {
      if (provinces[pid]) provinces[pid].ownerId = "mengjiang";
    }
  }

  const divisions: DivisionState[] = [];
  const supports: SupportState[] = [];
  for (const fid of FACTION_IDS) {
    if (!factions[fid]!.active) continue;
    const def = FACTIONS[fid];
    for (const d of def.initialDivisions) {
      const tpl = TEMPLATES[d.templateId]!;
      divisions.push({
        id: nid("div"),
        factionId: fid,
        templateId: d.templateId,
        provinceId: d.provinceId,
        strength: d.strength ?? tpl.fullStrength,
        movedTurn: 0,
        staticMonths: 0,
        org: 100,
      });
    }
    for (const s of def.initialSupports) {
      supports.push({ id: nid("sup"), factionId: fid, kind: s.kind, provinceId: s.provinceId, missionTargetId: s.provinceId });
    }
  }

  const relations: Record<string, number> = {};
  for (let i = 0; i < FACTION_IDS.length; i += 1) {
    for (let j = i + 1; j < FACTION_IDS.length; j += 1) {
      const a = FACTION_IDS[i]!;
      const b = FACTION_IDS[j]!;
      relations[relationPairKey(a, b)] = initialRelation(a, b);
    }
  }

  return {
    version: STATE_VERSION,
    seed,
    turn: 1,
    year: TIMELINE.startYear,
    month: TIMELINE.startMonth,
    playerFactionId,
    difficulty: options.difficulty ?? DEFAULT_DIFFICULTY,
    factions,
    provinces,
    divisions,
    groups: [],
    combatMarks: [],
    landingPlans: [],
    supports,
    production: [],
    relations,
    wars: [relationPairKey("roc", "ccp")], // 1936 国共内战状态（西安事变事件将结束之）
    alliances: [relationPairKey("japan", "manchukuo"), relationPairKey("ussr", "mongolia"), relationPairKey("usa", "philippines")],
    tradePacts: [],
    nonAggression: [],
    diplomacyCooldowns: {},
    firedEvents: [],
    gameOver: null,
    nextId,
    log: [
      {
        turn: 1,
        year: TIMELINE.startYear,
        month: TIMELINE.startMonth,
        kind: "system",
        text: `${TIMELINE.startYear} 年 ${TIMELINE.startMonth} 月，亚洲战场开局。玩家扮演：${FACTIONS[playerFactionId as keyof typeof FACTIONS]?.name ?? playerFactionId}。`,
      },
    ],
  };
}
