// 战斗结算（系统参数表 data/combatSystems.ts；攻击玩法重做后 ATTACK 只有一个动作，
// 差异来自部队构成/筹备/补给/地形/空海军在场，结算只读系统表做通用计算，不按系统名特判）。
// 战力 = Σ 师基础攻/防 x 编制比 x 地形 x 克制 x 科技（乘项积封顶 0.3-3.0）x 系统 x 支援 x 随机(0.85-1.15)。
// 战损折算实际人数；守军全灭或被击退则攻方占领；目标断补给时获胜全歼（包围）。
// 随机只走 core/rng 派生子流（同种子可复现）。

import {
  BASE_ATTACK, PLAN, FORTIFY, ENCIRCLEMENT, INFILTRATION, AIR, LANDING, RAID, SPEARHEAD, PURSUIT,
} from "../data/combatSystems";
import { PROVINCE_MAP, isRiverCrossing, RIVER_ATK_MULT, type ProvinceDef, type Terrain } from "../data/provinces";
import { TERRAIN_PARAMS, CLS_TERRAIN_DEFAULTS, PORT_DEF_MULT, MARINE_FEATURE_MULT } from "../data/terrain";
import {
  ORG_MIN_ATTACK, ORG_FORCED_STOP, ORG_ATTACK_COST_PER_PHASE, ORG_SUPPORT_COST_PER_PHASE,
  directionBonus, orgPowerFactor,
} from "../data/organization";
import { TEMPLATES, type DivisionTemplate } from "../data/units";
import { clamp } from "./guards";
import { neighborsOf, isSeaEdge } from "./mapGraph";
import { isAtWar, pushLog } from "./relations";
import { suppliedProvinces } from "./supply";
import { createRng } from "./rng";
import type { CombatMarkKind, DivisionState, GameState, SupportState } from "../state/types";

const DESTROY_THRESHOLD = 300;
const MULT_MIN = 0.3;
const MULT_MAX = 3.0;

function techMult(state: GameState, div: DivisionState, role: "atk" | "def"): number {
  const f = state.factions[div.factionId];
  const tpl = TEMPLATES[div.templateId]!;
  if (!f) return 1;
  let m = 1;
  if (tpl.cls === "infantry" || tpl.cls === "mountain" || tpl.cls === "garrison") {
    m *= 1 + 0.08 * (f.tech.infantry ?? 0);
  }
  if (tpl.cls === "armor" || tpl.cls === "motorized") {
    m *= 1 + 0.1 * (f.tech.armor ?? 0);
  }
  if (role === "atk") m *= 1 + 0.07 * (f.tech.artillery ?? 0);
  return m;
}

function supportMult(
  state: GameState, factionId: string, ownProvince: string, foeProvince: string,
  role: "atk" | "def", targetDef: ProvinceDef | undefined,
): number {
  const f = state.factions[factionId];
  const airTech = 1 + 0.1 * (f?.tech.air ?? 0);
  const navyTech = 1 + 0.1 * (f?.tech.navy ?? 0);
  let m = 1;
  // 在场口径（二期）：驻扎在该省，或任务正指向该省，都算在场
  const has = (kind: string, prov: string, fid: string) =>
    state.supports.some((s) => s.kind === kind && s.factionId === fid
      && (s.provinceId === prov || s.missionTargetId === prov));
  const foeIds = new Set(
    state.divisions.filter((d) => d.provinceId === foeProvince).map((d) => d.factionId),
  );
  const foeHasFighter = [...foeIds].some((fid) => has("fighter", foeProvince, fid));
  if (has("fighter", ownProvince, factionId) && !foeHasFighter) m *= 1 + 0.2 * airTech;
  if (role === "atk" && has("bomber", ownProvince, factionId)) m *= 1 + 0.15 * airTech;
  if (targetDef?.isPort || targetDef?.isIsland) {
    if (has("fleet", ownProvince, factionId) || has("fleet", foeProvince, factionId)) {
      m *= 1 + 0.2 * navyTech;
    }
  }
  return m;
}

function terrainModOf(tpl: DivisionTemplate, terrain: Terrain): number {
  return tpl.terrainMods[terrain] ?? CLS_TERRAIN_DEFAULTS[terrain]?.[tpl.cls] ?? 1;
}

function sidePower(
  state: GameState, divs: DivisionState[], role: "atk" | "def",
  terrain: Terrain, foeDivs: DivisionState[], targetDef?: ProvinceDef,
  divMult?: (div: DivisionState) => number,
): { base: number; mult: number; terrainMult: number } {
  let base = 0;
  let multWeighted = 0;
  let terrainWeighted = 0;
  let ratioSum = 0;
  for (const div of divs) {
    const tpl: DivisionTemplate = TEMPLATES[div.templateId]!;
    const stat = role === "atk" ? tpl.attack : tpl.defense;
    const ratio = div.strength / tpl.fullStrength;
    base += stat * ratio;
    ratioSum += ratio;
    const tm = terrainModOf(tpl, terrain)
      * (tpl.cls === "marine" && (targetDef?.isPort || targetDef?.isIsland) ? MARINE_FEATURE_MULT : 1);
    terrainWeighted += tm * ratio;
    let m = tm;
    if (divMult) m *= divMult(div); // 矛头等单师乘区
    m *= orgPowerFactor(div.org); // 组织度：师的体力条，低组织度战力显著下降
    m *= techMult(state, div, role);
    if (role === "atk" && foeDivs.length > 0) {
      // 克制：按守军编制加权的 counters 均值
      let counterSum = 0;
      let weightSum = 0;
      for (const foe of foeDivs) {
        const foeTpl = TEMPLATES[foe.templateId]!;
        counterSum += (tpl.counters[foeTpl.cls] ?? 1) * foe.strength;
        weightSum += foe.strength;
      }
      if (weightSum > 0) m *= counterSum / weightSum;
    }
    multWeighted += m * ratio;
  }
  const mult = base > 0 ? multWeighted / ratioSum : 1;
  const terrainMult = ratioSum > 0 ? terrainWeighted / ratioSum : 1;
  return { base, mult, terrainMult };
}

/** 静止层数（兵力加权平均，筹备攻势/坚守筑垒共用） */
function weightedLayers(divs: DivisionState[]): number {
  let sw = 0;
  let ss = 0;
  for (const d of divs) {
    sw += d.strength;
    ss += d.strength * Math.min(d.staticMonths, 12);
  }
  return sw > 0 ? ss / sw : 0;
}

export type AdvantageTier = "friendly" | "contested" | "enemy";

/** 三档优势工具（空优/制海同构）：二期任务口径——比较双方「任务指向本场目标省」的战斗机/舰队数量。 */
export function advantageTier(
  state: GameState, factionId: string, fromId: string, targetId: string, kind: "air" | "sea",
): AdvantageTier {
  void fromId; // 任务口径下出发省不再参与计数（保留签名兼容调用方）
  const unitKind = kind === "air" ? "fighter" : "fleet";
  const onMission = (s: SupportState) => s.missionTargetId === targetId;
  const mine = state.supports.filter(
    (s) => s.kind === unitKind && s.factionId === factionId && onMission(s),
  ).length;
  // 守方阵营 = 目标省驻军势力 + 目标省归属方（去掉攻方自己）
  const foeFactions = new Set(
    state.divisions.filter((d) => d.provinceId === targetId).map((d) => d.factionId),
  );
  const owner = state.provinces[targetId]?.ownerId;
  if (owner && owner !== "neutral") foeFactions.add(owner);
  foeFactions.delete(factionId);
  const foe = state.supports.filter(
    (s) => s.kind === unitKind && foeFactions.has(s.factionId) && onMission(s),
  ).length;
  return mine > foe ? "friendly" : mine < foe ? "enemy" : "contested";
}

export interface AttackEstimate {
  atkPower: number;
  defPower: number;
  ratio: number;
  attackerCount: number; // 主攻总数（前线+预备）
  defenderCount: number;
  supportCount: number; // 支援进攻师数（参战不进驻）
  atkFrontline: number;
  atkReserves: number;
  defFrontline: number;
  defReserves: number;
  terrain: Terrain;
  defTerrainMult: number; // 守方地形防御（含港口特征），供界面拆解展示
  capacity: number;
  origins: Array<{ provinceId: string; count: number }>; // 主攻来源（主攻在前）
  supportOrigins: Array<{ provinceId: string; count: number }>; // 支援来源
  modifiers: string[]; // 修正来源人话（预估/战报共用）
  targetSupplied: boolean; // 目标省是否在守方补给网内（false = 包围成立）
  spearheadCount: number;
  infiltrationActive: boolean;
  seaBattle: boolean;
}

function originsOf(divs: DivisionState[]): Array<{ provinceId: string; count: number }> {
  const counts = new Map<string, number>();
  for (const d of divs) counts.set(d.provinceId, (counts.get(d.provinceId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([provinceId, count]) => ({ provinceId, count }))
    .sort((a, b) => b.count - a.count);
}

/** 前线/预备队切分：按来源序（主攻来源优先）+ 兵力降序，前 capacity 个进前线。 */
function splitFrontline(
  divs: DivisionState[], capacity: number, rankOf?: (d: DivisionState) => number,
): { front: DivisionState[]; reserve: DivisionState[] } {
  const sorted = [...divs].sort(
    (a, b) => (rankOf ? rankOf(a) - rankOf(b) : 0) || b.strength - a.strength,
  );
  return { front: sorted.slice(0, capacity), reserve: sorted.slice(capacity) };
}

interface BattlePowers {
  atkPower: number;
  defPower: number;
  ratio: number;
  defTerrainMult: number;
  modifiers: string[];
  attackerLossMult: number;
  defenderLossMult: number;
}

/** 本场战斗的系统上下文（下令前由参与部队与目标决定，结算全程不变）。 */
export interface BattleContext {
  spearheads: ReadonlySet<string>;
  infiltrationActive: boolean;
  seaBattle: boolean;
}

/** 渗透触发判定：特性师兵力占比 ≥ INFILTRATION.minShare 且目标地形命中。 */
export function infiltrationActiveFor(
  participants: DivisionState[], targetId: string,
): boolean {
  const terrain = PROVINCE_MAP[targetId]?.terrain;
  if (!terrain || !(INFILTRATION.terrains as readonly string[]).includes(terrain)) return false;
  let total = 0;
  let inf = 0;
  for (const d of participants) {
    total += d.strength;
    if (TEMPLATES[d.templateId]?.infiltration) inf += d.strength;
  }
  return total > 0 && inf / total >= INFILTRATION.minShare;
}

/** 战力组装（预估与逐阶段结算共用）：atkDivs=主攻接战部队，supportDivs=支援进攻（全额计入火力）。 */
function battlePowers(
  state: GameState, attackerFactionId: string,
  atkDivs: DivisionState[], defDivs: DivisionState[], supportDivs: DivisionState[],
  targetId: string, ctx: BattleContext,
): BattlePowers {
  const targetDef = PROVINCE_MAP[targetId]!;
  const terrain = targetDef.terrain;
  const powerDivs = [...atkDivs, ...supportDivs];
  const allOrigins = originsOf(powerDivs);
  const fromId = originsOf(atkDivs)[0]?.provinceId ?? allOrigins[0]?.provinceId ?? targetId;
  const spearInForce = powerDivs.filter((d) => ctx.spearheads.has(d.id));
  const atk = sidePower(state, powerDivs, "atk", terrain, defDivs, targetDef,
    (d) => (ctx.spearheads.has(d.id) ? SPEARHEAD.powerMult : 1));
  const def = sidePower(state, defDivs, "def", terrain, powerDivs, targetDef);
  const modifiers: string[] = [];
  let atkMult = atk.mult * (ctx.seaBattle ? LANDING.attackMult : BASE_ATTACK.attackMult)
    * supportMult(state, attackerFactionId, fromId, targetId, "atk", targetDef);
  if (spearInForce.length > 0) {
    modifiers.push(`矛头 ${spearInForce.length} 师 ×${SPEARHEAD.powerMult}`);
  }
  // 计划（筹备）：自动按参战主攻师的静止层数结算
  {
    const layers = Math.min(weightedLayers(atkDivs), PLAN.maxLayers);
    const bonus = PLAN.perLayer * layers;
    if (bonus > 0) modifiers.push(`筹备 +${Math.round(bonus * 100)}%`);
    atkMult *= 1 + bonus;
  }
  // 任务口径（二期）：支援单位对本场生效 = 其任务指向本场目标省
  const hasKind = (kind: string) => state.supports.some(
    (s) => s.kind === kind && s.factionId === attackerFactionId && s.missionTargetId === targetId,
  );
  let casActive = false;
  if (ctx.seaBattle) {
    const tier = advantageTier(state, attackerFactionId, fromId, targetId, "sea");
    atkMult *= LANDING.seaTierMult[tier];
    modifiers.push(`制海 ${tier === "friendly" ? "我方" : tier === "enemy" ? "敌方" : "争夺中"}`);
    if (hasKind("fleet")) atkMult *= LANDING.fleetGunsMult;
  } else {
    // 空优门槛：任一方有战斗机任务指向目标省才结算三档（双方皆无 = 无空优修正）
    const fighterMissionCount = state.supports.filter(
      (s) => s.kind === "fighter" && s.missionTargetId === targetId,
    ).length;
    if (fighterMissionCount > 0) {
      const tier = advantageTier(state, attackerFactionId, fromId, targetId, "air");
      atkMult *= AIR.tierMult[tier];
      modifiers.push(`空优 ${tier === "friendly" ? "我方" : tier === "enemy" ? "敌方" : "争夺中"}`);
      if (hasKind("bomber")) {
        atkMult *= AIR.casMult;
        casActive = true;
        modifiers.push(`对地支援 ×${AIR.casMult}`);
      }
    }
  }
  // 多方向合击：包抄压力（出发省数，主攻+支援）
  const dirBonus = directionBonus(allOrigins.length);
  if (allOrigins.length > 1) modifiers.push(`包抄 ${allOrigins.length} 个方向 ×${dirBonus.toFixed(2)}`);
  atkMult *= dirBonus;
  const tp = TERRAIN_PARAMS[terrain];
  const defTerrainMult = tp.defMult * (targetDef.isPort ? PORT_DEF_MULT : 1);
  modifiers.push(`守方地形 ×${defTerrainMult.toFixed(2)}`);
  let defMult = def.mult * supportMult(state, defDivs[0]?.factionId ?? "", targetId, fromId, "def", targetDef)
    * defTerrainMult;
  if (defDivs.length > 0) {
    const layers = Math.min(weightedLayers(defDivs), FORTIFY.maxLayers * tp.fortCapMult);
    const bonus = FORTIFY.perLayer * layers;
    if (bonus > 0) modifiers.push(`筑垒 +${Math.round(bonus * 100)}%`);
    defMult *= 1 + bonus;
  }
  if (ctx.infiltrationActive && def.terrainMult > 0) {
    defMult = (defMult / def.terrainMult) * (1 + (def.terrainMult - 1) * INFILTRATION.defTerrainMult);
    modifiers.push("渗透：守方地形防御减半计");
  }
  // 包围：目标不在守方补给网内（任何进攻统一判定）
  const owner = state.provinces[targetId]?.ownerId ?? "neutral";
  if (owner !== "neutral" && !suppliedProvinces(state, owner).has(targetId)) {
    defMult *= ENCIRCLEMENT.unsuppliedDefMult;
    modifiers.push(`守军补给已断绝（包围）×${ENCIRCLEMENT.unsuppliedDefMult}`);
  }
  {
    let wSum = 0;
    let wStr = 0;
    let anyRiver = false;
    for (const d of powerDivs) {
      const river = isRiverCrossing(d.provinceId, targetId);
      if (river) anyRiver = true;
      wSum += (river ? RIVER_ATK_MULT : 1) * d.strength;
      wStr += d.strength;
    }
    if (wStr > 0) atkMult *= wSum / wStr;
    if (anyRiver) modifiers.push("含渡河进攻（加权 ×0.85）");
  }
  const atkPower = atk.base * clamp(atkMult, MULT_MIN, MULT_MAX);
  const defPower = Math.max(def.base * clamp(defMult, MULT_MIN, MULT_MAX), 0.001);
  const attackerLossMult = ctx.seaBattle
    ? LANDING.attackerLossMult
    : ctx.infiltrationActive ? INFILTRATION.attackerLossMult : BASE_ATTACK.attackerLossMult;
  const defenderLossMult = (ctx.seaBattle ? LANDING.defenderLossMult : BASE_ATTACK.defenderLossMult)
    * (casActive ? AIR.casDefLossMult : 1);
  return { atkPower, defPower, ratio: atkPower / defPower, defTerrainMult, modifiers, attackerLossMult, defenderLossMult };
}

export function estimateAttack(
  state: GameState, attackerFactionId: string, divisionIds: string[], targetId: string,
  supportDivisionIds: string[] = [], spearheadIds: string[] = [],
): AttackEstimate | null {
  const targetDef = PROVINCE_MAP[targetId];
  if (!targetDef) return null;
  const readyAdjacent = (ids: string[]) => {
    const set = new Set(ids);
    return state.divisions.filter(
      (d) => set.has(d.id) && d.factionId === attackerFactionId && d.movedTurn < state.turn
        && neighborsOf(d.provinceId).includes(targetId),
    );
  };
  const attackers = readyAdjacent(divisionIds);
  if (attackers.length === 0) return null;
  const mainIds = new Set(attackers.map((d) => d.id));
  const supports = readyAdjacent(supportDivisionIds).filter((d) => !mainIds.has(d.id));
  const origins = originsOf(attackers);
  const rank = new Map(origins.map((o, i) => [o.provinceId, i]));
  const defenders = defendersIn(state, attackerFactionId, targetId);
  const terrain = targetDef.terrain;
  const capacity = TERRAIN_PARAMS[terrain].capacity;
  const atkSplit = splitFrontline(attackers, capacity, (d) => rank.get(d.provinceId) ?? 99);
  const defSplit = splitFrontline(defenders, capacity);
  const participants = [...attackers, ...supports];
  const ctx: BattleContext = {
    spearheads: new Set(spearheadIds.filter((id) => mainIds.has(id))),
    infiltrationActive: infiltrationActiveFor(participants, targetId),
    seaBattle: participants.some((d) => isSeaEdge(d.provinceId, targetId)),
  };
  const powers = battlePowers(state, attackerFactionId, atkSplit.front, defSplit.front, supports, targetId, ctx);
  const owner = state.provinces[targetId]?.ownerId ?? "neutral";
  return {
    atkPower: powers.atkPower, defPower: powers.defPower, ratio: powers.ratio,
    attackerCount: attackers.length, defenderCount: defenders.length, supportCount: supports.length,
    atkFrontline: atkSplit.front.length, atkReserves: atkSplit.reserve.length,
    defFrontline: defSplit.front.length, defReserves: defSplit.reserve.length,
    terrain, defTerrainMult: powers.defTerrainMult, capacity,
    origins, supportOrigins: originsOf(supports), modifiers: powers.modifiers,
    targetSupplied: owner === "neutral" ? true : suppliedProvinces(state, owner).has(targetId),
    spearheadCount: ctx.spearheads.size,
    infiltrationActive: ctx.infiltrationActive,
    seaBattle: ctx.seaBattle,
  };
}

export function defendersIn(state: GameState, attackerFactionId: string, provinceId: string): DivisionState[] {
  const owner = state.provinces[provinceId]?.ownerId ?? "neutral";
  return state.divisions.filter((d) => {
    if (d.provinceId !== provinceId || d.factionId === attackerFactionId) return false;
    if (d.factionId === owner) return true; // 省份驻军（驻军方与攻方是否交战由调用方把关）
    return isAtWar(state, attackerFactionId, d.factionId); // 远征军
  });
}

export interface CombatOutcome {
  error: string | null;
  summary: string;
}

/** 游击袭扰独立结算（节点控制层，与战斗公式解耦）：得手降目标省产出（工业受损）、
 *  扰守军补给（驻军减员 5%）；驻军密度高（>=2 师）效率减半（受损 1 月、成功率降）。
 *  v1 临时反制即此密度规则；「涨根据地控制」需控制层状态，留待 v1.1 扫荡/化整为零时补。 */
function resolveRaid(
  draft: GameState, attackerFactionId: string, fromId: string, targetId: string,
  attackers: DivisionState[], defenders: DivisionState[],
): CombatOutcome {
  const targetDef = PROVINCE_MAP[targetId]!;
  const dense = defenders.length >= RAID.denseDefenders;
  const rng = createRng(draft.seed).derive(`raid:${attackerFactionId}:${fromId}:${targetId}:${draft.turn}`);
  const success = rng.next() < (dense ? RAID.successDense : RAID.successBase);
  for (const div of attackers) {
    div.movedTurn = draft.turn;
    div.staticMonths = 0;
  }
  let summary: string;
  if (success) {
    const months = dense ? RAID.denseDamagedMonths : RAID.damagedMonths;
    draft.provinces[targetId]!.damagedMonths = months;
    let defLosses = 0;
    for (const div of defenders) {
      const loss = Math.round(div.strength * RAID.garrisonLossRate);
      div.strength -= loss;
      defLosses += loss;
      div.staticMonths = 0;
    }
    summary = `${attackerFactionId} 自 ${PROVINCE_MAP[fromId]?.name ?? fromId} 袭扰 ${targetDef.name}：`
      + `得手，${targetDef.name} 工业受损 ${months} 月、守军扰动损失 ${defLosses} 人${dense ? "（驻军密集，效率减半）" : ""}`;
  } else {
    let atkLosses = 0;
    for (const div of attackers) {
      const loss = Math.round(div.strength * RAID.failLossRate);
      div.strength -= loss;
      atkLosses += loss;
    }
    draft.divisions = draft.divisions.filter((d) => {
      const threshold = TEMPLATES[d.templateId]?.guerrilla ? 150 : DESTROY_THRESHOLD;
      return d.strength >= threshold;
    });
    summary = `${attackerFactionId} 自 ${PROVINCE_MAP[fromId]?.name ?? fromId} 袭扰 ${targetDef.name}：`
      + `未果，损失 ${atkLosses} 人`;
  }
  recordMark(draft, targetId, "raid"); // C5 战斗标记：游击袭击
  pushLog(draft, "battle", summary);
  return { error: null, summary };
}

/** 袭扰动作入口（RAID）：仅游击类模板可下，可小股跨海；校验与旧模式口径一致。 */
export function resolveRaidAction(
  draft: GameState, attackerFactionId: string, divisionIds: string[], targetId: string,
): CombatOutcome {
  const targetProv = draft.provinces[targetId];
  const targetDef = PROVINCE_MAP[targetId];
  if (!targetProv || !targetDef) return { error: `UNKNOWN_PROVINCE: ${targetId}`, summary: "" };
  const owner = targetProv.ownerId;
  const defenders = defendersIn(draft, attackerFactionId, targetId);
  const ownerAtWar = owner !== "neutral" && isAtWar(draft, attackerFactionId, owner);
  const hasEnemyPresent = defenders.some((d) => isAtWar(draft, attackerFactionId, d.factionId));
  if (!ownerAtWar && owner !== "neutral" && !hasEnemyPresent) {
    return { error: `NOT_AT_WAR: ${owner}`, summary: "" };
  }
  const set = new Set(divisionIds);
  const attackers = draft.divisions.filter((d) => set.has(d.id) && d.factionId === attackerFactionId);
  if (attackers.length === 0) return { error: "NO_DIVISIONS", summary: "" };
  if (attackers.some((d) => !TEMPLATES[d.templateId]?.guerrilla)) {
    return { error: "GUERRILLA_MODE_REQUIRES_GUERRILLA_UNIT", summary: "" };
  }
  if (attackers.some((d) => !neighborsOf(d.provinceId).includes(targetId))) {
    return { error: "NOT_ADJACENT", summary: "" };
  }
  if (attackers.some((d) => d.movedTurn >= draft.turn)) {
    return { error: "DIVISION_ALREADY_ACTED", summary: "" };
  }
  if (attackers.some((d) => d.org < ORG_MIN_ATTACK)) {
    return { error: "ORG_TOO_LOW", summary: "" };
  }
  const fromId = originsOf(attackers)[0]!.provinceId;
  return resolveRaid(draft, attackerFactionId, fromId, targetId, attackers, defenders);
}

/** 战斗标记落账（C5）：同省同回合只留一条，后打的覆盖先打的。 */
function recordMark(draft: GameState, provinceId: string, kind: CombatMarkKind): void {
  draft.combatMarks = draft.combatMarks.filter((m) => m.provinceId !== provinceId);
  draft.combatMarks.push({ provinceId, kind, turn: draft.turn });
}

export function resolveAttack(
  draft: GameState, attackerFactionId: string, divisionIds: string[], targetId: string,
  supportDivisionIds: string[] = [], spearheadIds: string[] = [], viaPlan = false,
): CombatOutcome {
  const targetProv = draft.provinces[targetId];
  const targetDef = PROVINCE_MAP[targetId];
  if (!targetProv || !targetDef) return { error: `UNKNOWN_PROVINCE: ${targetId}`, summary: "" };
  const owner = targetProv.ownerId;
  const ownerAtWar = owner !== "neutral" && isAtWar(draft, attackerFactionId, owner);
  const defenders = defendersIn(draft, attackerFactionId, targetId);
  const hasEnemyPresent = defenders.some((d) => isAtWar(draft, attackerFactionId, d.factionId));
  if (!ownerAtWar && owner !== "neutral" && !hasEnemyPresent) {
    return { error: `NOT_AT_WAR: ${owner}`, summary: "" };
  }
  const pick = (ids: string[]) => {
    const set = new Set(ids);
    return draft.divisions.filter((d) => set.has(d.id) && d.factionId === attackerFactionId);
  };
  const attackers = pick(divisionIds);
  if (attackers.length === 0) return { error: "NO_DIVISIONS", summary: "" };
  const mainIdSet = new Set(attackers.map((d) => d.id));
  const supports = pick(supportDivisionIds).filter((d) => !mainIdSet.has(d.id));
  const participants = [...attackers, ...supports];
  if (participants.some((d) => !neighborsOf(d.provinceId).includes(targetId))) {
    return { error: "NOT_ADJACENT", summary: "" };
  }
  if (participants.some((d) => d.movedTurn >= draft.turn)) {
    return { error: "DIVISION_ALREADY_ACTED", summary: "" };
  }
  if (participants.some((d) => d.org < ORG_MIN_ATTACK)) {
    return { error: "ORG_TOO_LOW", summary: "" };
  }
  // 矛头：必须是主攻子集且不超过上限
  const spearheads = new Set(spearheadIds);
  if (spearheads.size > SPEARHEAD.maxCount) return { error: "SPEARHEAD_LIMIT", summary: "" };
  if ([...spearheads].some((id) => !mainIdSet.has(id))) {
    return { error: "SPEARHEAD_NOT_IN_FORCE", summary: "" };
  }
  // 跨海进攻逐师判定：跨海师必须自港口出发（一期口径；三期改登陆项目制）
  const seaAttackers = participants.filter((d) => isSeaEdge(d.provinceId, targetId));
  // 三期：跨海进攻改登陆项目制——直接 ATTACK 跨海一律拒绝，须 PREPARE_LANDING 后 EXECUTE（viaPlan）
  if (seaAttackers.length > 0 && !viaPlan) {
    return { error: "AMPHIBIOUS_REQUIRES_PLAN", summary: "" };
  }
  if (seaAttackers.some((d) => !PROVINCE_MAP[d.provinceId]?.isPort)) {
    return { error: "AMPHIBIOUS_REQUIRES_PORT_DEPARTURE", summary: "" };
  }
  const origins = originsOf(attackers);
  const fromId = origins[0]!.provinceId;
  const ctx: BattleContext = {
    spearheads,
    infiltrationActive: infiltrationActiveFor(participants, targetId),
    seaBattle: seaAttackers.length > 0,
  };

  // —— 持续战斗（月内阶段结算）：前线接战、预备队递补、组织度消耗 ——
  const terrain = targetDef.terrain;
  const capacity = TERRAIN_PARAMS[terrain].capacity;
  const rank = new Map(origins.map((o, i) => [o.provinceId, i]));
  const atkSplit = splitFrontline(attackers, capacity, (d) => rank.get(d.provinceId) ?? 99);
  const defSplit = splitFrontline(defenders, capacity);
  let atkFront = atkSplit.front;
  let atkReserve = atkSplit.reserve;
  let defFront = defSplit.front;
  let defReserve = defSplit.reserve;
  for (const div of participants) {
    div.movedTurn = draft.turn;
    div.staticMonths = 0; // 进攻消耗筹备层
  }
  for (const div of defenders) div.staticMonths = 0; // 受击清筑垒层
  const destroyed = new Set<string>();
  const markDestroyed = (divs: DivisionState[]) => {
    for (const div of divs) {
      const threshold = TEMPLATES[div.templateId]?.guerrilla ? 150 : DESTROY_THRESHOLD;
      if (div.strength < threshold) destroyed.add(div.id);
    }
  };
  const alive = (divs: DivisionState[]) => divs.filter((d) => !destroyed.has(d.id));
  const promote = (front: DivisionState[], reserve: DivisionState[]): DivisionState[] => {
    const next = alive(front);
    const pool = alive(reserve);
    while (next.length < capacity && pool.length > 0) next.push(pool.shift()!);
    return next;
  };
  const rng = createRng(draft.seed).derive(`combat:${attackerFactionId}:${fromId}:${targetId}:${draft.turn}`);
  const PHASE_NAMES = ["接敌", "激战", "决战"];
  const PHASE_LOSS_SCALE = 0.55;
  const phaseReports: string[] = [];
  let firstPowers: BattlePowers | null = null;
  let atkLosses = 0;
  let defLosses = 0;
  let result: "win" | "lose" | "stop" | null = null;
  let finalRatio = 0;
  for (let p = 0; p < PHASE_NAMES.length; p += 1) {
    atkFront = promote(atkFront, atkReserve);
    atkReserve = alive(atkReserve).filter((d) => !atkFront.includes(d));
    defFront = promote(defFront, defReserve);
    defReserve = alive(defReserve).filter((d) => !defFront.includes(d));
    if (alive(attackers).length === 0) { result = "lose"; break; }
    if (alive(defenders).length === 0) { result = "win"; break; }
    const powers = battlePowers(draft, attackerFactionId, atkFront, defFront, supports.filter((d) => !destroyed.has(d.id)), targetId, ctx);
    if (!firstPowers) firstPowers = powers;
    const atkRoll = 0.85 + rng.next() * 0.3;
    const defRoll = 0.85 + rng.next() * 0.3;
    const ratio = (powers.atkPower * atkRoll) / (powers.defPower * defRoll);
    finalRatio = ratio;
    const defLossRate = clamp(clamp(0.18 + 0.12 * ratio, 0.05, 0.75) * powers.defenderLossMult, 0, 0.9) * PHASE_LOSS_SCALE;
    const atkLossRate = clamp(clamp(0.3 / Math.max(ratio, 0.4), 0.05, 0.75) * powers.attackerLossMult, 0, 0.9) * PHASE_LOSS_SCALE;
    for (const div of atkFront) {
      const isSpear = spearheads.has(div.id);
      const loss = Math.round(div.strength * atkLossRate * (isSpear ? SPEARHEAD.lossMult : 1));
      div.strength -= loss;
      atkLosses += loss;
      div.org = Math.max(0, div.org - ORG_ATTACK_COST_PER_PHASE * (isSpear ? SPEARHEAD.orgCostMult : 1));
    }
    for (const div of supports) {
      if (destroyed.has(div.id)) continue;
      const loss = Math.round(div.strength * atkLossRate * 0.35);
      div.strength -= loss;
      atkLosses += loss;
      div.org = Math.max(0, div.org - ORG_SUPPORT_COST_PER_PHASE);
    }
    for (const div of defFront) {
      const loss = Math.round(div.strength * defLossRate);
      div.strength -= loss;
      defLosses += loss;
      div.org = Math.max(0, div.org - 3);
    }
    markDestroyed([...atkFront, ...defFront, ...supports]);
    phaseReports.push(`${PHASE_NAMES[p]} 战力比 ${ratio.toFixed(2)}`);
    const frontAlive = alive(atkFront);
    if (frontAlive.length > 0
      && frontAlive.reduce((sum, d) => sum + d.org, 0) / frontAlive.length < ORG_FORCED_STOP) {
      result = "stop"; // 组织度崩溃：被迫停攻
      break;
    }
    if (p >= 1 && ratio > 2.2) { result = "win"; break; } // 守军崩溃
    if (p >= 1 && ratio < 0.45) { result = "lose"; break; } // 攻势顿挫
  }
  if (!result) result = finalRatio >= 1 ? "win" : "lose";
  markDestroyed([...attackers, ...defenders, ...supports]);
  const survivingDefenders = alive(defenders);
  let occupied = false;
  let encircled = false;
  if (result === "win" && ENCIRCLEMENT.destroyOnWin) {
    encircled = owner !== "neutral" && !suppliedProvinces(draft, owner).has(targetId);
  }
  if (result === "win") {
    for (const div of survivingDefenders) {
      const retreat = encircled ? undefined : neighborsOf(targetId)
        .filter((nb) => draft.provinces[nb]?.ownerId === div.factionId)
        .sort()[0];
      if (retreat) div.provinceId = retreat;
      else destroyed.add(div.id);
    }
    if (ownerAtWar || owner === "neutral") {
      targetProv.ownerId = attackerFactionId;
      occupied = true;
      // 只有主攻编组进驻；支援进攻部队留原省；矛头优先进驻
      const ordered = [...attackers].sort(
        (a, b) => Number(spearheads.has(b.id)) - Number(spearheads.has(a.id)),
      );
      for (const div of ordered) {
        if (!destroyed.has(div.id)) div.provinceId = targetId;
      }
    }
  }
  draft.divisions = draft.divisions.filter((d) => !destroyed.has(d.id));

  // —— 突破追击（三期）：决胜大胜（终局比 ≥2.2）且占领成功后，合格快速师向纵深多走一格 ——
  let pursuitText = "";
  if (result === "win" && occupied && finalRatio >= PURSUIT.minRatio) {
    const attackerIds = new Set(attackers.map((a) => a.id));
    const pursuerPool = draft.divisions.filter((d) =>
      d.factionId === attackerFactionId && d.provinceId === targetId && attackerIds.has(d.id)
      && (PURSUIT.classes as readonly string[]).includes(TEMPLATES[d.templateId]?.cls ?? "")
      && d.org >= PURSUIT.minOrg
      && (spearheads.size === 0 || spearheads.has(d.id)));
    if (pursuerPool.length > 0) {
      const pursuerStrength = pursuerPool.reduce((sum, d) => sum + d.strength, 0);
      const candidates: Array<{ pid: string; defs: DivisionState[]; defStrength: number }> = [];
      for (const nb of neighborsOf(targetId)) {
        if (isSeaEdge(targetId, nb)) continue; // 追击只走陆路
        const o = draft.provinces[nb]?.ownerId;
        if (!o || o === "neutral" || o === attackerFactionId || !isAtWar(draft, attackerFactionId, o)) continue;
        const defs = defendersIn(draft, attackerFactionId, nb);
        const defStrength = defs.reduce((sum, d) => sum + d.strength, 0);
        if (defs.length === 0 || defStrength <= pursuerStrength * PURSUIT.weakDefRatio) {
          candidates.push({ pid: nb, defs, defStrength });
        }
      }
      candidates.sort((a, b) => a.defStrength - b.defStrength || (a.pid < b.pid ? -1 : 1));
      const tgt = candidates[0];
      if (tgt) {
        const tgtDef = PROVINCE_MAP[tgt.pid]!;
        let advanced = false;
        if (tgt.defs.length === 0) {
          advanced = true;
          pursuitText = `；追击：${pursuerPool.length} 个快速师乘胜追击、占领无守军的 ${tgtDef.name}`;
        } else {
          // 一阶段速决战：战力公式同正战，战损 ×clashLossScale，不连环追击
          const clashCtx: BattleContext = {
            spearheads: new Set(), infiltrationActive: infiltrationActiveFor(pursuerPool, tgt.pid), seaBattle: false,
          };
          const powers = battlePowers(draft, attackerFactionId, pursuerPool, tgt.defs, [], tgt.pid, clashCtx);
          const cRng = createRng(draft.seed).derive(`pursuit:${attackerFactionId}:${targetId}:${tgt.pid}:${draft.turn}`);
          const ratio = (powers.atkPower * (0.85 + cRng.next() * 0.3)) / (powers.defPower * (0.85 + cRng.next() * 0.3));
          const defLossRate = clamp(clamp(0.18 + 0.12 * ratio, 0.05, 0.75) * powers.defenderLossMult, 0, 0.9) * PURSUIT.clashLossScale;
          const atkLossRate = clamp(clamp(0.3 / Math.max(ratio, 0.4), 0.05, 0.75) * powers.attackerLossMult, 0, 0.9) * PURSUIT.clashLossScale;
          for (const div of pursuerPool) div.strength -= Math.round(div.strength * atkLossRate);
          const clashDestroyed = new Set<string>();
          for (const div of tgt.defs) {
            div.strength -= Math.round(div.strength * defLossRate);
            const threshold = TEMPLATES[div.templateId]?.guerrilla ? 150 : DESTROY_THRESHOLD;
            if (div.strength < threshold) clashDestroyed.add(div.id);
          }
          if (ratio >= 1) {
            advanced = true;
            const tgtSupplied = suppliedProvinces(draft, draft.provinces[tgt.pid]!.ownerId).has(tgt.pid);
            for (const div of tgt.defs) {
              if (clashDestroyed.has(div.id)) continue;
              const retreat = tgtSupplied
                ? neighborsOf(tgt.pid).filter((x) => draft.provinces[x]?.ownerId === div.factionId).sort()[0]
                : undefined;
              if (retreat) div.provinceId = retreat; else clashDestroyed.add(div.id);
            }
            if (clashDestroyed.size > 0) draft.divisions = draft.divisions.filter((d) => !clashDestroyed.has(d.id));
            pursuitText = `；追击：${pursuerPool.length} 个快速师速决击破 ${tgtDef.name} 弱守军（战力比 ${ratio.toFixed(2)}）、乘胜占领`;
          } else {
            pursuitText = `；追击：快速师向 ${tgtDef.name} 速决未克（战力比 ${ratio.toFixed(2)}）、止步于 ${targetDef.name}`;
          }
        }
        if (advanced) {
          draft.provinces[tgt.pid]!.ownerId = attackerFactionId;
          for (const div of pursuerPool) div.provinceId = tgt.pid;
          recordMark(draft, tgt.pid, "battle");
        }
        for (const div of pursuerPool) div.org = Math.max(0, div.org - PURSUIT.orgCost);
      }
    }
  }

  const attackerName = draft.factions[attackerFactionId]?.id ?? attackerFactionId;
  const originsText = origins.map((o, i) => `${i === 0 ? "主攻" : "助攻"} ${PROVINCE_MAP[o.provinceId]?.name ?? o.provinceId} ${o.count} 师`).join("＋");
  const supportText = supports.length > 0
    ? `＋支援 ${originsOf(supports).map((o) => `${PROVINCE_MAP[o.provinceId]?.name ?? o.provinceId} ${o.count} 师`).join("＋")}`
    : "";
  const outcomeText = result === "win"
    ? (occupied ? `，占领 ${targetDef.name}` : "，击退守军")
    : result === "stop" ? "，组织度崩溃被迫停攻" : "，进攻被击退";
  const spearText = spearheads.size > 0
    ? `（矛头 ${[...spearheads].map((id) => TEMPLATES[draft.divisions.find((d) => d.id === id)?.templateId ?? ""]?.name ?? id).join("、")}）`
    : "";
  const summary = `${attackerName} 自 ${originsText}${supportText} 攻 ${targetDef.name}${spearText}：`
    + `${phaseReports.join(" → ")}`
    + (firstPowers && firstPowers.modifiers.length > 0 ? `；修正：${firstPowers.modifiers.join("、")}` : "")
    + `；攻方损失 ${atkLosses} 人、守方损失 ${defLosses} 人`
    + (destroyed.size > 0 ? `，${destroyed.size} 个师被歼` : "")
    + (encircled ? "（包围断补给，守军无路可退）" : "")
    + outcomeText
    + pursuitText;
  // C5 战斗标记优先级：包围（全歼事件最具体）> 登陆（行动类型）> 大捷（终局比 ≥2.2）> 空袭（CAS 在场）> 交战
  const casApplied = firstPowers?.modifiers.some((m) => m.includes("对地支援")) ?? false;
  recordMark(draft, targetId,
    encircled ? "encircle"
    : ctx.seaBattle ? "landing"
    : result === "win" && finalRatio >= PURSUIT.minRatio ? "decisive"
    : casApplied ? "airraid"
    : "battle");
  pushLog(draft, "battle", summary);
  return { error: null, summary };
}
