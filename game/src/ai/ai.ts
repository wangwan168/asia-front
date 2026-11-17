// 规则 AI：每国按 aiPersonality（侵略/扩张/工业/谨慎）决策，全部动作只经 applyAction 落地。
// 备战期：建厂/造兵/科研/国策；战争期：按局部战力比决定进攻（攻击模式按情形选）、
// 劣势收缩、游击势力渗透敌后。外交：同阵营结盟、 opportunist 宣战（1938 年前以事件驱动为主）、劣势求和。

import { FACTIONS } from "../data/factions";
import { FOCUS_MAP } from "../data/focuses";
import { PROVINCES, PROVINCE_MAP } from "../data/provinces";
import { TEMPLATES } from "../data/units";
import { estimateAttack } from "../core/combat";
import { neighborsOf, isSeaEdge } from "../core/mapGraph";
import { reachableWithin, findMovePaths } from "../core/movement";
import { centroidDistance } from "../core/mapGraph";
import {
  factionPower, isAllied, isAtWar, ownedProvinces, relationOf,
} from "../core/relations";
import { createRng } from "../core/rng";
import type { GameAction } from "../core/applyAction";
import type { GameState } from "../state/types";

const MAX_AI_ACTIONS = 60;

function neighborFactions(state: GameState, factionId: string): Set<string> {
  const result = new Set<string>();
  for (const pid of ownedProvinces(state, factionId)) {
    for (const nb of neighborsOf(pid)) {
      const owner = state.provinces[nb]?.ownerId;
      if (owner && owner !== "neutral" && owner !== factionId) result.add(owner);
    }
  }
  return result;
}

function atWarWithAnyone(state: GameState, factionId: string): string[] {
  return Object.keys(state.factions).filter(
    (o) => o !== factionId && isAtWar(state, factionId, o),
  );
}

export function planAiActions(state: GameState, factionId: string): GameAction[] {
  const f = state.factions[factionId];
  const def = FACTIONS[factionId as keyof typeof FACTIONS];
  if (!f || !def || !f.active || !f.alive) return [];
  const actions: GameAction[] = [];
  const rng = createRng(state.seed).derive(`ai:${factionId}:${state.turn}`);
  const persona = def.aiPersonality;
  const capital = def.capitalProvinceId;
  const owned = ownedProvinces(state, factionId);
  if (owned.length === 0 && state.divisions.every((d) => d.factionId !== factionId)) return [];
  const wars = atWarWithAnyone(state, factionId);
  const atWar = wars.length > 0;

  // 科研：未设定时按性格选分支
  if (!f.researchBranch) {
    const branches: Array<"industry" | "infantry" | "artillery" | "armor" | "air" | "navy"> =
      persona.industry >= 0.6
        ? ["industry", "infantry", "artillery", "armor", "air"]
        : ["infantry", "artillery", "armor", "industry", "navy"];
    actions.push({
      type: "SET_RESEARCH", factionId,
      branch: branches[state.turn % branches.length]!,
    });
  }

  // 国策：无进行中时启动第一个未完成的
  if (!f.focusId) {
    const next = Object.values(FOCUS_MAP).find(
      (fc) => fc.factionId === factionId && !f.completedFocuses.includes(fc.id),
    );
    if (next) actions.push({ type: "START_FOCUS", factionId, focusId: next.id });
  }

  // 建厂：建设点够两座时建一座军工（工业倾向低的建民用）
  if (f.constructionPoints >= 120 && owned.length > 0) {
    const best = [...owned].sort(
      (a, b) => (PROVINCE_MAP[b]!.industry) - (PROVINCE_MAP[a]!.industry),
    )[0]!;
    actions.push({
      type: "BUILD_FACTORY", factionId, provinceId: best,
      factory: persona.industry >= 0.4 ? "mil" : "civ",
    });
  }

  // 造兵：前线省优先（交战时），否则首都
  const front = owned.find((pid) => neighborsOf(pid).some(
    (nb) => {
      const o = state.provinces[nb]?.ownerId;
      return o && o !== "neutral" && isAtWar(state, factionId, o);
    },
  ));
  const buildAt = (atWar && front) ? front : (owned.includes(capital) ? capital : owned[0]);
  if (buildAt) {
    const queued = state.production.filter((p) => p.factionId === factionId).length;
    if (queued < 4) {
      const specialty = Object.values(TEMPLATES).find((t) => t.factionId === factionId);
      let templateId = "infantry";
      if (specialty && rng.next() < 0.5) templateId = specialty.id;
      else if (f.stockpile.equipment > 420 && persona.industry > 0.5 && rng.next() < 0.4) templateId = "armor";
      else if (persona.caution > 0.7 && !atWar) templateId = "garrison";
      else if (TEMPLATES[templateId] && def.id === "ccp") templateId = "eighthRoute";
      const tpl = TEMPLATES[templateId]!;
      if (f.stockpile.equipment >= tpl.equipmentCost * 1.2 && f.stockpile.manpower >= tpl.fullStrength * 1.5) {
        actions.push({ type: "BUILD_DIVISION", factionId, provinceId: buildAt, templateId });
      }
    }
    // 空军：装备富余且无战斗机时补一联队
    if (f.stockpile.equipment > 650 && !state.supports.some((s) => s.factionId === factionId && s.kind === "fighter")) {
      actions.push({ type: "BUILD_SUPPORT", factionId, provinceId: buildAt, kind: "fighter" });
    }
  }

  // 外交
  const monthsSinceStart = (state.year - 1936) * 12 + (state.month - 1);
  if (!atWar && monthsSinceStart >= 24 && persona.aggression > 0.55 && rng.next() < persona.aggression) {
    // 机会主义宣战：挑相邻弱者（非盟友、无互不侵犯、关系冷淡）
    const myPower = factionPower(state, factionId);
    for (const other of neighborFactions(state, factionId)) {
      const of = state.factions[other];
      if (!of || !of.active || !of.alive || of.vassalOf === factionId) continue;
      if (isAllied(state, factionId, other)) continue;
      if (state.nonAggression.includes([factionId, other].sort().join("__"))) continue;
      if (relationOf(state, factionId, other) >= 60) continue;
      if (factionPower(state, other) < myPower * (0.35 + persona.aggression * 0.3)) {
        actions.push({ type: "DIPLOMACY", factionId, targetId: other, actionId: "declareWar" });
        break;
      }
    }
  }
  // 盟友参战：与盟友关系极深（>=90）且自身不怯战时，主动对其敌人宣战（如满洲国随日本对华作战）。
  // 门槛定 90 是为了防连锁：结盟动作本身会 +15 关系，中苏初始 70 结盟后 85 仍不达标，
  // 苏联不会被拖入中国内战；日满初始 90、日蒙（蒙疆）结盟后 90 才够格参战。
  if (!atWar || persona.aggression >= 0.35) {
    for (const ally of Object.keys(state.factions)) {
      if (ally === factionId || !isAllied(state, factionId, ally)) continue;
      if (relationOf(state, factionId, ally) < 90) continue;
      const allyWars = atWarWithAnyone(state, ally);
      for (const enemy of allyWars) {
        if (enemy === factionId || isAtWar(state, factionId, enemy)) continue;
        if (relationOf(state, factionId, enemy) >= 60) continue;
        if (persona.aggression >= 0.35 && rng.next() < 0.6) {
          actions.push({ type: "DIPLOMACY", factionId, targetId: enemy, actionId: "declareWar" });
        }
      }
    }
  }
  if (atWar) {
    // 劣势求和（谨慎者）
    const myPower = factionPower(state, factionId);
    for (const enemy of wars) {
      if (persona.caution > 0.5 && factionPower(state, enemy) > myPower * 1.6 && rng.next() < 0.5) {
        actions.push({ type: "DIPLOMACY", factionId, targetId: enemy, actionId: "peace" });
      }
    }
    // 同阵营结盟
    for (const other of Object.keys(state.factions)) {
      const of = state.factions[other];
      if (!of || other === factionId || !of.active || !of.alive) continue;
      if (of.bloc === f.bloc && f.bloc !== "neutral" && !isAllied(state, factionId, other)
        && relationOf(state, factionId, other) >= 65) {
        actions.push({ type: "DIPLOMACY", factionId, targetId: other, actionId: "alliance" });
        break;
      }
    }
  }

  // 登陆项目（三期）：就绪计划先执行；无计划且交战时以港口部队筹备一次（同规则、无后门）
  const myPlans = (state.landingPlans ?? []).filter((p) => p.factionId === factionId);
  const lockedIds = new Set<string>();
  for (const p of state.landingPlans ?? []) for (const id of p.divisionIds) lockedIds.add(id);
  for (const p of myPlans) {
    if (state.turn >= p.readyTurn) actions.push({ type: "EXECUTE_LANDING", factionId, planId: p.id });
  }
  if (myPlans.length === 0 && atWar) {
    let prepared = false;
    for (const pid of owned) {
      if (prepared) break;
      if (!PROVINCE_MAP[pid]?.isPort) continue;
      const here = state.divisions.filter(
        (d) => d.factionId === factionId && d.provinceId === pid && d.movedTurn < state.turn && !lockedIds.has(d.id),
      );
      if (here.length === 0) continue;
      for (const nb of neighborsOf(pid)) {
        if (!isSeaEdge(pid, nb)) continue;
        const o = state.provinces[nb]?.ownerId;
        if (!o || o === factionId) continue;
        if (o !== "neutral" && !isAtWar(state, factionId, o)) continue;
        const est = estimateAttack(state, factionId, here.map((d) => d.id), nb);
        if (est && est.ratio > 1.0) {
          actions.push({
            type: "PREPARE_LANDING", factionId,
            divisionIds: here.map((d) => d.id), fromProvinceId: pid, targetProvinceId: nb,
          });
          prepared = true;
          break;
        }
      }
    }
  }

  // 军事：以省份为单位组织进攻；其余部队向前线机动（登陆锁定师不参与）
  const myDivisions = state.divisions.filter(
    (d) => d.factionId === factionId && d.movedTurn < state.turn && !lockedIds.has(d.id),
  );
  const byProvince = new Map<string, number>();
  for (const d of myDivisions) byProvince.set(d.provinceId, (byProvince.get(d.provinceId) ?? 0) + 1);
  const attackedFrom = new Set<string>();
  for (const pid of byProvince.keys()) {
    const enemyNeighbors = neighborsOf(pid).filter((nb) => {
      const o = state.provinces[nb]?.ownerId;
      return (o && o !== "neutral" && isAtWar(state, factionId, o))
        || state.divisions.some((d) => d.provinceId === nb && isAtWar(state, factionId, d.factionId));
    });
    if (enemyNeighbors.length === 0) continue;
    let bestTarget: string | null = null;
    let bestRatio = 0;
    const readyHere0 = myDivisions.filter((d) => d.provinceId === pid);
    // 整省皆游击类 → 袭扰而非正面进攻（独立 RAID 动作）
    if (readyHere0.length > 0 && readyHere0.every((d) => TEMPLATES[d.templateId]?.guerrilla)) {
      actions.push({
        type: "RAID", factionId,
        divisionIds: readyHere0.map((d) => d.id),
        targetProvinceId: enemyNeighbors[0]!,
      });
      attackedFrom.add(pid);
      continue;
    }
    for (const nb of enemyNeighbors) {
      if (readyHere0.some((d) => isSeaEdge(d.provinceId, nb))) continue; // 跨海走登陆项目，不在此直攻
      const readyIds = readyHere0.map((d) => d.id);
      const est = estimateAttack(state, factionId, readyIds, nb);
      if (est && est.ratio > bestRatio) {
        bestRatio = est.ratio;
        bestTarget = nb;
      }
    }
    const readyHere = myDivisions.filter((d) => d.provinceId === pid);
    // 矛头：快速师（装甲/摩托化）按兵力取最强 1-2 个；战力比 [1.0,1.6] 时指定，
    // 且原本不够阈值的仗可先按带矛头预估复核、够线才打（设计稿 §8）
    const fastSorted = readyHere
      .filter((d) => ["armor", "motorized"].includes(TEMPLATES[d.templateId]?.cls ?? ""))
      .sort((a, b) => b.strength - a.strength);
    const spearIds = fastSorted.slice(0, 2).map((d) => d.id);
    let useSpear = false;
    if (bestTarget && spearIds.length > 0 && bestRatio >= 1.0 && bestRatio <= 1.6) {
      useSpear = true;
    }
    const threshold = 1.15 + (1 - persona.aggression) * 0.3;
    if (bestTarget && bestRatio <= threshold && useSpear) {
      const est2 = estimateAttack(state, factionId, readyHere.map((d) => d.id), bestTarget, [], spearIds);
      if (est2 && est2.ratio > threshold) bestRatio = est2.ratio;
    }
    if (bestTarget && bestRatio > threshold) {
      actions.push({
        type: "ATTACK", factionId,
        divisionIds: readyHere.map((d) => d.id),
        targetProvinceId: bestTarget,
        ...(useSpear ? { spearheadIds: spearIds } : {}),
      });
      attackedFrom.add(pid);
    }
  }
  // 预备轮换（三期，仅 AI 行为）：前线低组织度师退后休整、后方高组织度师补上，每月 ≤2 次
  const rotatedIds = new Set<string>();
  {
    const actedIds = new Set<string>();
    for (const a of actions) {
      if (a.type === "ATTACK" || a.type === "RAID") for (const id of a.divisionIds) actedIds.add(id);
    }
    const frontline = new Set(owned.filter((pid) => neighborsOf(pid).some((nb) => {
      const o = state.provinces[nb]?.ownerId;
      return o && o !== "neutral" && o !== factionId && isAtWar(state, factionId, o);
    })));
    const tired = myDivisions.filter((d) => frontline.has(d.provinceId) && d.org < 35 && !actedIds.has(d.id));
    const fresh = myDivisions.filter((d) => !frontline.has(d.provinceId) && d.org >= 80 && !actedIds.has(d.id));
    let swaps = 0;
    for (const t of tired) {
      if (swaps >= 2) break;
      const paths = findMovePaths(state, t);
      const rear = [...paths.keys()]
        .filter((p) => state.provinces[p]?.ownerId === factionId && !frontline.has(p))
        .sort((a, b) => centroidDistance(a, t.provinceId) - centroidDistance(b, t.provinceId))[0];
      if (!rear) continue;
      actions.push({ type: "MOVE_UNITS", factionId, divisionIds: [t.id], toProvinceId: rear });
      rotatedIds.add(t.id);
      swaps += 1;
      const f = fresh.find((x) => !rotatedIds.has(x.id));
      if (f) {
        actions.push({ type: "MOVE_UNITS", factionId, divisionIds: [f.id], toProvinceId: t.provinceId });
        rotatedIds.add(f.id);
      }
    }
  }

  // 机动：不在进攻省份的部队向最近的敌邻省份靠拢
  const enemyProvinces = Object.values(state.provinces)
    .filter((p) => p.ownerId !== "neutral" && isAtWar(state, factionId, p.ownerId))
    .map((p) => p.id);
  if (enemyProvinces.length > 0) {
    for (const div of myDivisions) {
      if (rotatedIds.has(div.id)) continue;
      if (attackedFrom.has(div.provinceId)) continue;
      if (actions.length >= MAX_AI_ACTIONS) break;
      const reach = reachableWithin(state, div);
      if (reach.size === 0) continue;
      let bestProv: string | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const cand of reach.keys()) {
        const candDef = PROVINCE_MAP[cand]!;
        for (const ep of enemyProvinces) {
          const dist = centroidDistance(candDef.id, ep);
          if (dist < bestDist) {
            bestDist = dist;
            bestProv = cand;
          }
        }
      }
      if (bestProv && bestProv !== div.provinceId) {
        actions.push({
          type: "MOVE_UNITS", factionId, divisionIds: [div.id], toProvinceId: bestProv,
        });
      }
    }
  }

  // 空军/舰队任务（二期）：本月主攻目标 = 任务目标（在首个 ATTACK 之前插入，动作按序生效）
  {
    const firstAtkIdx = actions.findIndex((a) => a.type === "ATTACK");
    const mainAtk = firstAtkIdx >= 0 ? actions[firstAtkIdx] as Extract<GameAction, { type: "ATTACK" }> : null;
    const mainTarget = mainAtk?.targetProvinceId ?? null;
    const seaMain = mainAtk != null && mainAtk.divisionIds.some((id) => {
      const d = state.divisions.find((x) => x.id === id);
      return d != null && isSeaEdge(d.provinceId, mainAtk.targetProvinceId);
    });
    const missionActions: GameAction[] = [];
    for (const sup of state.supports.filter((x) => x.factionId === factionId)) {
      let want: string | null = null;
      if (sup.kind === "fighter" || sup.kind === "bomber") {
        want = mainTarget; // 无进攻时保持原任务
      } else if (sup.kind === "fleet") {
        if (seaMain && mainTarget) want = mainTarget;
        else {
          // 无登陆主攻：指向驻扎省最近的敌方港口省；无敌港则回驻扎省
          let bestP: string | null = null;
          let bestD = Number.POSITIVE_INFINITY;
          for (const p of PROVINCES) {
            const o = state.provinces[p.id]?.ownerId;
            if (!o || o === "neutral" || !p.isPort || !isAtWar(state, factionId, o)) continue;
            const dist = centroidDistance(sup.provinceId, p.id);
            if (dist < bestD) { bestD = dist; bestP = p.id; }
          }
          want = bestP ?? sup.provinceId;
        }
      }
      if (want && want !== sup.missionTargetId) {
        missionActions.push({ type: "SET_SUPPORT_MISSION", factionId, supportId: sup.id, targetProvinceId: want });
      }
    }
    if (missionActions.length > 0) {
      if (firstAtkIdx >= 0) actions.splice(firstAtkIdx, 0, ...missionActions);
      else actions.push(...missionActions);
    }
  }

  return actions.slice(0, MAX_AI_ACTIONS);
}
