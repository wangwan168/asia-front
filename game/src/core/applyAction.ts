// 状态变更唯一入口。所有动作（玩家/AI/事件外）都经此处校验与执行；非法动作不抛异常，
// 返回原状态 + error。END_TURN 链：推进月份 -> 历史事件 -> 全体月结算 -> 各 AI 势力行动 -> 胜负判定。
// 铁律：不设回合上限——游戏结束只由胜负条件决定（core/victory.ts）；没接 LLM 不影响任何动作。

import { advanceYearMonth } from "../data/timeline";
import { ECONOMY } from "../data/economy";
import { LANDING } from "../data/combatSystems";
import { ORG_MIN_ATTACK } from "../data/organization";
import { PROVINCE_MAP } from "../data/provinces";
import { FACTIONS } from "../data/factions";
import { FOCUS_MAP } from "../data/focuses";
import { SUPPORTS, TEMPLATES } from "../data/units";
import { TECH_BRANCHES, type TechBranch } from "../data/tech";
import {
  DIPLOMACY_ACTIONS, DIPLOMACY_RUNTIME, relationPairKey,
  type DiplomacyActionId,
} from "../data/diplomacy";
import { planAiActions } from "../ai/ai";
import { resolveAttack, resolveRaidAction } from "./combat";
import { fireDueEvents } from "./events";
import { areAdjacent, isSeaEdge } from "./mapGraph";
import { reachableWithin, findMovePaths, advanceAlongPath } from "./movement";
import { factionPower, isAtWar, pushLog, relationOf } from "./relations";
import { settleAllFactions } from "./settlement";
import { checkVictory } from "./victory";
import { clampPercent } from "./guards";
import type { GameState, SupportKind } from "../state/types";

export type GameAction =
  | { type: "END_TURN" }
  | { type: "NOOP"; note?: string }
  | { type: "BUILD_DIVISION"; factionId: string; provinceId: string; templateId: string }
  | { type: "BUILD_FACTORY"; factionId: string; provinceId: string; factory: "mil" | "civ" }
  | { type: "BUILD_SUPPORT"; factionId: string; provinceId: string; kind: SupportKind }
  | { type: "SET_SUPPORT_MISSION"; factionId: string; supportId: string; targetProvinceId: string }
  | { type: "PREPARE_LANDING"; factionId: string; divisionIds: string[]; fromProvinceId: string; targetProvinceId: string }
  | { type: "EXECUTE_LANDING"; factionId: string; planId: string }
  | { type: "CANCEL_LANDING"; factionId: string; planId: string }
  | { type: "SET_RESEARCH"; factionId: string; branch: TechBranch }
  | { type: "START_FOCUS"; factionId: string; focusId: string }
  | { type: "MOVE_UNITS"; factionId: string; divisionIds: string[]; toProvinceId: string }
  | { type: "ATTACK"; factionId: string; divisionIds: string[]; targetProvinceId: string; supportDivisionIds?: string[]; spearheadIds?: string[] }
  | { type: "RAID"; factionId: string; divisionIds: string[]; targetProvinceId: string }
  | { type: "HOLD_POSITION"; factionId: string; divisionIds: string[] }
  | { type: "CREATE_GROUP"; factionId: string; name: string; divisionIds: string[] }
  | { type: "DELETE_GROUP"; factionId: string; groupId: string }
  | { type: "SET_GROUP_MEMBERS"; factionId: string; groupId: string; divisionIds: string[] }
  | { type: "DIPLOMACY"; factionId: string; targetId: string; actionId: DiplomacyActionId }
  | { type: "BREAK_VASSAL"; factionId: string };

export interface ActionResult {
  state: GameState;
  error: string | null;
}

const ACTION_TYPES = new Set([
  "END_TURN", "NOOP", "BUILD_DIVISION", "BUILD_FACTORY", "BUILD_SUPPORT", "SET_RESEARCH", "SET_SUPPORT_MISSION", "PREPARE_LANDING", "EXECUTE_LANDING", "CANCEL_LANDING",
  "START_FOCUS", "MOVE_UNITS", "ATTACK", "RAID", "HOLD_POSITION", "CREATE_GROUP", "DELETE_GROUP", "SET_GROUP_MEMBERS", "DIPLOMACY", "BREAK_VASSAL",
]);

function fail(state: GameState, error: string): ActionResult {
  return { state, error };
}

function requireActiveFaction(state: GameState, factionId: unknown): string | null {
  if (typeof factionId !== "string") return "MISSING_FACTION";
  const f = state.factions[factionId];
  if (!f) return `UNKNOWN_FACTION: ${factionId}`;
  if (!f.active) return `FACTION_INACTIVE: ${factionId}`;
  if (!f.alive) return `FACTION_ELIMINATED: ${factionId}`;
  return null;
}

function doDiplomacy(draft: GameState, actorId: string, targetId: string, actionId: DiplomacyActionId): string | null {
  const actor = draft.factions[actorId]!;
  const target = draft.factions[targetId];
  const def = DIPLOMACY_ACTIONS.find((a) => a.id === actionId);
  if (!def) return `UNKNOWN_DIPLOMACY_ACTION: ${actionId}`;
  if (!target) return `UNKNOWN_FACTION: ${targetId}`;
  if (!target.active) return `FACTION_INACTIVE: ${targetId}`;
  if (!target.alive) return `FACTION_ELIMINATED: ${targetId}`;
  if (actorId === targetId) return "DIPLOMACY_SELF";
  const cooldownKey = `${actorId}|${targetId}|${actionId}`;
  if ((draft.diplomacyCooldowns[cooldownKey] ?? 0) > draft.turn) return "DIPLOMACY_COOLDOWN";
  const key = relationPairKey(actorId, targetId);
  const relation = relationOf(draft, actorId, targetId);
  const atWar = isAtWar(draft, actorId, targetId);

  if (actionId === "declareWar") {
    if (atWar) return "ALREADY_AT_WAR";
    if (target.vassalOf === actorId || actor.vassalOf === targetId) {
      // 宣战即解除附庸关系
      if (target.vassalOf === actorId) target.vassalOf = null;
      if (actor.vassalOf === targetId) actor.vassalOf = null;
    }
    draft.wars.push(key);
    draft.alliances = draft.alliances.filter((k) => k !== key);
    draft.tradePacts = draft.tradePacts.filter((k) => k !== key);
    draft.nonAggression = draft.nonAggression.filter((k) => k !== key);
    draft.relations[key] = def.relationSetTo ?? 0;
    actor.warSupport = clampPercent(actor.warSupport + 5);
    target.warSupport = clampPercent(target.warSupport + 5);
    draft.diplomacyCooldowns[cooldownKey] = draft.turn + DIPLOMACY_RUNTIME.cooldownTurns;
    pushLog(draft, "diplomacy", `${FACTIONS[actorId as keyof typeof FACTIONS]?.name ?? actorId} 向 ${FACTIONS[targetId as keyof typeof FACTIONS]?.name ?? targetId} 宣战。`);
    return null;
  }

  if (actor.stockpile.equipment < def.costEquipment) return "INSUFFICIENT_EQUIPMENT";
  if (actionId !== "peace" && actionId !== "envoy" && relation < def.requiresMinRelation) {
    return `RELATION_TOO_LOW: need ${def.requiresMinRelation}, got ${relation}`;
  }

  let accepted = true;
  if (actionId === "peace") {
    if (!atWar) return "NOT_AT_WAR";
    const targetDef = FACTIONS[targetId as keyof typeof FACTIONS];
    accepted = factionPower(draft, targetId) < factionPower(draft, actorId) * 1.2
      || ((targetDef?.aiPersonality.caution ?? 0) > 0.55 && target.warSupport < 55);
    if (accepted) {
      draft.wars = draft.wars.filter((k) => k !== key);
      if (!draft.nonAggression.includes(key)) draft.nonAggression.push(key);
      draft.relations[key] = Math.max(relation, 30);
    }
  } else if (actionId === "alliance") {
    if (atWar) return "AT_WAR";
    if (draft.alliances.includes(key)) return "ALREADY_ALLIED";
    draft.alliances.push(key);
    // 注意：结盟不自动卷入对方现有战争——参战与否由各势力自行宣战决定
    // （否则 1936 年中共与苏联结盟会把苏联直接拖入中国内战，与史实和玩法都不符）。
  } else if (actionId === "trade") {
    if (atWar) return "AT_WAR";
    if (draft.tradePacts.includes(key)) return "ALREADY_TRADE_PACT";
    draft.tradePacts.push(key);
  } else if (actionId === "nonAggression") {
    if (atWar) return "AT_WAR";
    if (draft.nonAggression.includes(key)) return "ALREADY_NON_AGGRESSION";
    draft.nonAggression.push(key);
  } else if (actionId === "vassalize") {
    if (atWar) return "AT_WAR";
    if (target.vassalOf) return "TARGET_ALREADY_VASSAL";
    if (actor.vassalOf) return "ACTOR_IS_VASSAL";
    accepted = factionPower(draft, targetId) < factionPower(draft, actorId) * 0.45;
    if (accepted) {
      target.vassalOf = actorId;
      if (!draft.alliances.includes(key)) draft.alliances.push(key);
    }
  }
  // envoy 无附加条件

  actor.stockpile.equipment -= def.costEquipment;
  draft.relations[key] = clampPercent(relation + (accepted ? def.relationDelta : 5));
  draft.diplomacyCooldowns[cooldownKey] = draft.turn + DIPLOMACY_RUNTIME.cooldownTurns;
  if (!accepted) return `DIPLOMACY_REJECTED: ${actionId}`;
  pushLog(draft, "diplomacy", `${FACTIONS[actorId as keyof typeof FACTIONS]?.name ?? actorId} 对 ${FACTIONS[targetId as keyof typeof FACTIONS]?.name ?? targetId}：${def.name} 成功。`);
  return null;
}

/** 登陆筹备锁定的师集合（三期）：计划存续期间这些师不得行军/进攻/袭扰/驻扎/改编组。 */
export function landingLockedIds(state: GameState): Set<string> {
  const set = new Set<string>();
  for (const p of state.landingPlans ?? []) for (const id of p.divisionIds) set.add(id);
  return set;
}

export function applyAction(state: GameState, action: unknown): ActionResult {
  if (typeof action !== "object" || action === null) {
    return fail(state, `UNKNOWN_ACTION: ${String(action)}`);
  }
  const type = (action as { type?: unknown }).type;
  if (typeof type !== "string" || !ACTION_TYPES.has(type)) {
    return fail(state, `UNKNOWN_ACTION: ${String(type)}`);
  }
  const a = action as GameAction;

  if (a.type === "NOOP") return { state, error: null };
  if (state.gameOver && a.type !== "END_TURN") return fail(state, "GAME_OVER");

  switch (a.type) {
    case "END_TURN": {
      if (state.gameOver) return fail(state, "GAME_OVER");
      let draft: GameState = structuredClone(state);
      // C5 战斗标记只保留本回合的：上回合标记展示满一回合后清除
      draft.combatMarks = draft.combatMarks.filter((m) => m.turn >= draft.turn);
      const next = advanceYearMonth({ year: draft.year, month: draft.month });
      draft.turn += 1;
      draft.year = next.year;
      draft.month = next.month;
      fireDueEvents(draft);
      settleAllFactions(draft);
      // 登陆计划月结清理：过期（readyTurn 已过）/出发港易主/参战师被歼 → 自动取消并纪事
      draft.landingPlans = draft.landingPlans.filter((p) => {
        const dead = draft.turn > p.readyTurn
          || draft.provinces[p.fromProvinceId]?.ownerId !== p.factionId
          || p.divisionIds.some((id) => !draft.divisions.some((d) => d.id === id));
        if (dead) {
          pushLog(draft, "event", `${p.factionId} 的登陆计划（${PROVINCE_MAP[p.fromProvinceId]?.name ?? p.fromProvinceId} → ${PROVINCE_MAP[p.targetProvinceId]?.name ?? p.targetProvinceId}）已自动取消（过期、出发港易主或参战师被歼）`);
        }
        return !dead;
      });
      // AI 势力依次行动（玩家势力跳过）
      for (const fid of Object.keys(draft.factions)) {
        if (fid === draft.playerFactionId || draft.gameOver) continue;
        const f = draft.factions[fid];
        if (!f || !f.active || !f.alive) continue;
        const actions = planAiActions(draft, fid);
        for (const aiAction of actions) {
          const res = applyAction(draft, aiAction);
          if (res.error === null) draft = res.state;
        }
      }
      // 行军续程：未走完路径的部队自动续走（本回合已行动者不重复——其 movedTurn 与当前回合相同）
      for (const div of draft.divisions) {
        if (div.pathIds && div.pathIds.length > 0 && div.movedTurn < draft.turn) {
          advanceAlongPath(draft, div);
        }
      }
      checkVictory(draft);
      return { state: draft, error: null };
    }
    case "BUILD_DIVISION": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const tpl = TEMPLATES[a.templateId];
      if (!tpl) return fail(state, `UNKNOWN_TEMPLATE: ${a.templateId}`);
      if (tpl.factionId && tpl.factionId !== a.factionId) return fail(state, "TEMPLATE_FACTION_MISMATCH");
      const prov = state.provinces[a.provinceId];
      if (!prov) return fail(state, `UNKNOWN_PROVINCE: ${a.provinceId}`);
      if (prov.ownerId !== a.factionId && !tpl.guerrilla) return fail(state, "PROVINCE_NOT_OWNED");
      const f = state.factions[a.factionId]!;
      if (f.stockpile.equipment < tpl.equipmentCost) return fail(state, "INSUFFICIENT_EQUIPMENT");
      if (f.stockpile.manpower < tpl.fullStrength) return fail(state, "INSUFFICIENT_MANPOWER");
      const draft = structuredClone(state);
      const df = draft.factions[a.factionId]!;
      df.stockpile.equipment -= tpl.equipmentCost;
      df.stockpile.manpower -= tpl.fullStrength;
      draft.production.push({
        id: `prod-${draft.nextId++}`, factionId: a.factionId, kind: "division",
        templateId: a.templateId, supportKind: null, provinceId: a.provinceId,
        monthsLeft: tpl.buildMonths,
      });
      return { state: draft, error: null };
    }
    case "BUILD_FACTORY": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const prov = state.provinces[a.provinceId];
      if (!prov) return fail(state, `UNKNOWN_PROVINCE: ${a.provinceId}`);
      if (prov.ownerId !== a.factionId) return fail(state, "PROVINCE_NOT_OWNED");
      const f = state.factions[a.factionId]!;
      if (f.constructionPoints < ECONOMY.factoryBuildCost) return fail(state, "INSUFFICIENT_CONSTRUCTION");
      const draft = structuredClone(state);
      draft.factions[a.factionId]!.constructionPoints -= ECONOMY.factoryBuildCost;
      draft.production.push({
        id: `prod-${draft.nextId++}`, factionId: a.factionId,
        kind: a.factory === "mil" ? "factoryMil" : "factoryCiv",
        templateId: null, supportKind: null, provinceId: a.provinceId,
        monthsLeft: ECONOMY.factoryBuildMonths,
      });
      return { state: draft, error: null };
    }
    case "BUILD_SUPPORT": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const def = SUPPORTS[a.kind];
      if (!def) return fail(state, `UNKNOWN_SUPPORT_KIND: ${a.kind}`);
      const prov = state.provinces[a.provinceId];
      if (!prov) return fail(state, `UNKNOWN_PROVINCE: ${a.provinceId}`);
      if (prov.ownerId !== a.factionId) return fail(state, "PROVINCE_NOT_OWNED");
      const f = state.factions[a.factionId]!;
      if (f.stockpile.equipment < def.equipmentCost) return fail(state, "INSUFFICIENT_EQUIPMENT");
      const draft = structuredClone(state);
      draft.factions[a.factionId]!.stockpile.equipment -= def.equipmentCost;
      draft.production.push({
        id: `prod-${draft.nextId++}`, factionId: a.factionId, kind: "support",
        templateId: null, supportKind: a.kind, provinceId: a.provinceId,
        monthsLeft: def.buildMonths,
      });
      return { state: draft, error: null };
    }
    case "SET_SUPPORT_MISSION": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const sup = state.supports.find((x) => x.id === a.supportId);
      if (!sup) return fail(state, `UNKNOWN_SUPPORT: ${a.supportId}`);
      if (sup.factionId !== a.factionId) return fail(state, "SUPPORT_NOT_OWNED");
      if (!state.provinces[a.targetProvinceId]) return fail(state, `UNKNOWN_PROVINCE: ${a.targetProvinceId}`);
      const draft = structuredClone(state);
      draft.supports.find((x) => x.id === a.supportId)!.missionTargetId = a.targetProvinceId;
      return { state: draft, error: null };
    }
    case "SET_RESEARCH": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      if (!TECH_BRANCHES[a.branch]) return fail(state, `UNKNOWN_TECH_BRANCH: ${a.branch}`);
      const draft = structuredClone(state);
      draft.factions[a.factionId]!.researchBranch = a.branch;
      return { state: draft, error: null };
    }
    case "START_FOCUS": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const def = FOCUS_MAP[a.focusId];
      if (!def || def.factionId !== a.factionId) return fail(state, `UNKNOWN_FOCUS: ${a.focusId}`);
      const f = state.factions[a.factionId]!;
      if (f.focusId) return fail(state, "FOCUS_ALREADY_ACTIVE");
      if (f.completedFocuses.includes(a.focusId)) return fail(state, "FOCUS_ALREADY_COMPLETED");
      const draft = structuredClone(state);
      const df = draft.factions[a.factionId]!;
      df.focusId = a.focusId;
      df.focusMonthsLeft = def.months;
      return { state: draft, error: null };
    }
    case "MOVE_UNITS": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      if (!state.provinces[a.toProvinceId]) return fail(state, `UNKNOWN_PROVINCE: ${a.toProvinceId}`);
      if (a.divisionIds.length === 0) return fail(state, "NO_DIVISIONS");
      const divs = a.divisionIds.map((id) => state.divisions.find((d) => d.id === id));
      if (divs.some((d) => !d || d!.factionId !== a.factionId)) return fail(state, "UNKNOWN_DIVISION");
      if (a.divisionIds.some((id) => landingLockedIds(state).has(id))) return fail(state, "LANDING_LOCKED");
      if (divs.some((d) => d!.movedTurn >= state.turn)) return fail(state, "DIVISION_ALREADY_ACTED");
      // 逐师求路径（全图 Dijkstra，不限月预算）：任一师无路则整令不达
      const paths = new Map<string, string[]>();
      for (const d of divs) {
        const p = findMovePaths(state, d!).get(a.toProvinceId);
        if (!p && a.toProvinceId !== d!.provinceId) return fail(state, "NOT_REACHABLE");
        paths.set(d!.id, p ?? []);
      }
      const draft = structuredClone(state);
      for (const d of divs) {
        const dd = draft.divisions.find((x) => x.id === d!.id)!;
        dd.pathIds = paths.get(d!.id)!.length > 0 ? [...paths.get(d!.id)!] : undefined;
        advanceAlongPath(draft, dd); // 当月先走一段（预算内），余程存 pathIds 下月续走
        dd.movedTurn = draft.turn;
        dd.staticMonths = 0; // 移动清筹备/筑垒层
      }
      return { state: draft, error: null };
    }
    case "HOLD_POSITION": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      if (a.divisionIds.some((id) => landingLockedIds(state).has(id))) return fail(state, "LANDING_LOCKED");
      const draft = structuredClone(state);
      for (const id of a.divisionIds) {
        const dd = draft.divisions.find((d) => d.id === id && d.factionId === a.factionId);
        if (dd) dd.pathIds = undefined; // 驻扎防守：清行军路径，静止攒筑垒/筹备层（不消耗行动）
      }
      return { state: draft, error: null };
    }
    case "CREATE_GROUP": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const name = a.name.trim();
      if (!name) return fail(state, "GROUP_NAME_EMPTY");
      const draft = structuredClone(state);
      const gid = `grp-${draft.nextId++}`;
      draft.groups = [...(draft.groups ?? []), { id: gid, factionId: a.factionId, name }];
      for (const id of a.divisionIds) {
        const dd = draft.divisions.find((d) => d.id === id && d.factionId === a.factionId);
        if (dd) dd.groupId = gid;
      }
      return { state: draft, error: null };
    }
    case "DELETE_GROUP": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const draft = structuredClone(state);
      draft.groups = (draft.groups ?? []).filter((g) => !(g.id === a.groupId && g.factionId === a.factionId));
      for (const dd of draft.divisions) {
        if (dd.groupId === a.groupId) dd.groupId = null;
      }
      return { state: draft, error: null };
    }
    case "SET_GROUP_MEMBERS": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const grp = (state.groups ?? []).find((g) => g.id === a.groupId && g.factionId === a.factionId);
      if (!grp) return fail(state, "UNKNOWN_GROUP");
      if (a.divisionIds.some((id) => landingLockedIds(state).has(id))) return fail(state, "LANDING_LOCKED");
      const draft = structuredClone(state);
      const wanted = new Set(a.divisionIds);
      for (const dd of draft.divisions) {
        if (dd.factionId !== a.factionId) continue;
        if (wanted.has(dd.id)) dd.groupId = a.groupId;
        else if (dd.groupId === a.groupId) dd.groupId = null;
      }
      return { state: draft, error: null };
    }
    case "ATTACK": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      if (!state.provinces[a.targetProvinceId]) return fail(state, "UNKNOWN_PROVINCE");
      if (a.divisionIds.length === 0) return fail(state, "NO_DIVISIONS");
      {
        const locked = landingLockedIds(state);
        if ([...a.divisionIds, ...(a.supportDivisionIds ?? [])].some((id) => locked.has(id))) return fail(state, "LANDING_LOCKED");
      }
      const draft = structuredClone(state);
      const outcome = resolveAttack(draft, a.factionId, a.divisionIds, a.targetProvinceId, a.supportDivisionIds ?? [], a.spearheadIds ?? []);
      if (outcome.error) return fail(state, outcome.error);
      return { state: draft, error: null };
    }
    case "RAID": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      if (!state.provinces[a.targetProvinceId]) return fail(state, "UNKNOWN_PROVINCE");
      if (a.divisionIds.length === 0) return fail(state, "NO_DIVISIONS");
      if (a.divisionIds.some((id) => landingLockedIds(state).has(id))) return fail(state, "LANDING_LOCKED");
      const draft = structuredClone(state);
      const outcome = resolveRaidAction(draft, a.factionId, a.divisionIds, a.targetProvinceId);
      if (outcome.error) return fail(state, outcome.error);
      return { state: draft, error: null };
    }
    case "PREPARE_LANDING": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const fromDef = PROVINCE_MAP[a.fromProvinceId];
      const targetDef = PROVINCE_MAP[a.targetProvinceId];
      if (!fromDef || !targetDef) return fail(state, "UNKNOWN_PROVINCE");
      if (!fromDef.isPort) return fail(state, "LANDING_REQUIRES_PORT");
      if (state.provinces[a.fromProvinceId]?.ownerId !== a.factionId) return fail(state, "PROVINCE_NOT_OWNED");
      if (!isSeaEdge(a.fromProvinceId, a.targetProvinceId)) return fail(state, "LANDING_REQUIRES_SEA_LINK");
      const tOwner = state.provinces[a.targetProvinceId]?.ownerId ?? "neutral";
      if (tOwner === a.factionId) return fail(state, "TARGET_ALREADY_OWNED");
      if (tOwner !== "neutral" && !isAtWar(state, a.factionId, tOwner)) return fail(state, `NOT_AT_WAR: ${tOwner}`);
      if (a.divisionIds.length === 0) return fail(state, "NO_DIVISIONS");
      const locked = landingLockedIds(state);
      const divs = a.divisionIds.map((id) => state.divisions.find((d) => d.id === id));
      if (divs.some((d) => !d || d!.factionId !== a.factionId)) return fail(state, "UNKNOWN_DIVISION");
      if (divs.some((d) => d!.provinceId !== a.fromProvinceId)) return fail(state, "LANDING_DIVISION_NOT_AT_PORT");
      if (divs.some((d) => d!.movedTurn >= state.turn)) return fail(state, "DIVISION_ALREADY_ACTED");
      if (divs.some((d) => d!.org < ORG_MIN_ATTACK)) return fail(state, "ORG_TOO_LOW");
      if (a.divisionIds.some((id) => locked.has(id))) return fail(state, "LANDING_LOCKED");
      const draft = structuredClone(state);
      const planId = `plan-${draft.nextId++}`;
      draft.landingPlans.push({
        id: planId, factionId: a.factionId, divisionIds: [...a.divisionIds],
        fromProvinceId: a.fromProvinceId, targetProvinceId: a.targetProvinceId,
        readyTurn: draft.turn + LANDING.prepMonths,
      });
      for (const id of a.divisionIds) {
        const dd = draft.divisions.find((d) => d.id === id)!;
        dd.movedTurn = draft.turn; // 筹备消耗当月行动
        dd.pathIds = undefined;
      }
      pushLog(draft, "event", `${a.factionId} 筹备登陆：自 ${fromDef.name} 港出发，目标 ${targetDef.name}（次月可执行）`);
      return { state: draft, error: null };
    }
    case "EXECUTE_LANDING": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const plan = (state.landingPlans ?? []).find((p) => p.id === a.planId && p.factionId === a.factionId);
      if (!plan) return fail(state, `UNKNOWN_PLAN: ${a.planId}`);
      if (state.turn < plan.readyTurn) return fail(state, "PLAN_NOT_READY");
      const draft = structuredClone(state);
      draft.landingPlans = draft.landingPlans.filter((p) => p.id !== plan.id); // 出航即消耗计划
      const originLost = draft.provinces[plan.fromProvinceId]?.ownerId !== a.factionId;
      const divsGone = plan.divisionIds.some((id) => {
        const d = draft.divisions.find((x) => x.id === id);
        return !d || d.provinceId !== plan.fromProvinceId;
      });
      if (originLost || divsGone) return { state: draft, error: "PLAN_INVALID" };
      const outcome = resolveAttack(draft, a.factionId, plan.divisionIds, plan.targetProvinceId, [], [], true);
      if (outcome.error) return { state: draft, error: outcome.error };
      return { state: draft, error: null };
    }
    case "CANCEL_LANDING": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const plan = (state.landingPlans ?? []).find((p) => p.id === a.planId && p.factionId === a.factionId);
      if (!plan) return fail(state, `UNKNOWN_PLAN: ${a.planId}`);
      const draft = structuredClone(state);
      draft.landingPlans = draft.landingPlans.filter((p) => p.id !== plan.id);
      pushLog(draft, "event", `${a.factionId} 取消登陆计划（${PROVINCE_MAP[plan.fromProvinceId]?.name ?? plan.fromProvinceId} → ${PROVINCE_MAP[plan.targetProvinceId]?.name ?? plan.targetProvinceId}）`);
      return { state: draft, error: null };
    }
    case "DIPLOMACY": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const draft = structuredClone(state);
      const dErr = doDiplomacy(draft, a.factionId, a.targetId, a.actionId);
      if (dErr && !dErr.startsWith("DIPLOMACY_REJECTED")) return fail(state, dErr);
      if (dErr) return { state: draft, error: dErr }; // 拒绝也产生状态变化（关系微升/冷却/成本），如实返回
      return { state: draft, error: null };
    }
    case "BREAK_VASSAL": {
      const err = requireActiveFaction(state, a.factionId);
      if (err) return fail(state, err);
      const f = state.factions[a.factionId]!;
      if (!f.vassalOf) return fail(state, "NOT_A_VASSAL");
      const draft = structuredClone(state);
      const df = draft.factions[a.factionId]!;
      const overlord = df.vassalOf!;
      df.vassalOf = null;
      const key = relationPairKey(a.factionId, overlord);
      draft.relations[key] = clampPercent((draft.relations[key] ?? 50) - 20);
      draft.alliances = draft.alliances.filter((k) => k !== key);
      pushLog(draft, "diplomacy", `${FACTIONS[a.factionId as keyof typeof FACTIONS]?.name ?? a.factionId} 宣布脱离附庸地位。`);
      return { state: draft, error: null };
    }
    default: {
      return fail(state, `UNHANDLED_ACTION: ${String(type)}`);
    }
  }
}
