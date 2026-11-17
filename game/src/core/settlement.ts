// 月结算（END_TURN 链）：省份收入 -> 工业产出/建设/科研 -> 国策/生产队列推进 ->
// 补给与维持（无补给衰减）-> 补员 -> 附庸进贡/贸易收益 -> 稳定度漂移 -> 出局判定。
// 难度倍率仅对非玩家势力统一生效（data/economy DIFFICULTY），玩家恒 1.0。

import { ECONOMY, DIFFICULTY } from "../data/economy";
import { FACTIONS } from "../data/factions";
import { FOCUS_MAP, type FocusEffect } from "../data/focuses";
import { PROVINCE_MAP } from "../data/provinces";
import { DIPLOMACY_RUNTIME, relationPairKey } from "../data/diplomacy";
import { TECH_BRANCHES, RESEARCH_PER_CIV_FACTORY } from "../data/tech";
import { TEMPLATES } from "../data/units";
import { TERRAIN_PARAMS } from "../data/terrain";
import { clamp, clampPercent } from "./guards";
import { pushLog } from "./relations";
import { suppliedProvinces } from "./supply";
import { ORG_MAX, ORG_RECOVERY_BASE, ORG_RECOVERY_UNSUPPLIED_MULT } from "../data/organization";
import type { GameState } from "../state/types";

export function difficultyMult(state: GameState, factionId: string): number {
  if (factionId === state.playerFactionId) return 1;
  return DIFFICULTY.find((d) => d.id === state.difficulty)?.aiMult ?? 1;
}

export function applyFocusEffects(draft: GameState, factionId: string, effects: FocusEffect[]): void {
  const f = draft.factions[factionId];
  if (!f) return;
  for (const e of effects) {
    switch (e.kind) {
      case "addEquipment": f.stockpile.equipment += e.amount; break;
      case "addManpower": f.stockpile.manpower += e.amount; break;
      case "addResource": f.stockpile[e.resource] += e.amount; break;
      case "addFactory": {
        const prov = draft.provinces[e.provinceId];
        if (prov && prov.ownerId === factionId) {
          if (e.factory === "mil") prov.factoriesMil += 1;
          else prov.factoriesCiv += 1;
        }
        break;
      }
      case "stability": f.stability = clampPercent(f.stability + e.delta); break;
      case "warSupport": f.warSupport = clampPercent(f.warSupport + e.delta); break;
      case "relation": {
        const key = relationPairKey(factionId, e.targetId);
        draft.relations[key] = clampPercent((draft.relations[key] ?? 50) + e.delta);
        break;
      }
    }
  }
}

function settleFaction(draft: GameState, factionId: string): void {
  const f = draft.factions[factionId];
  if (!f || !f.active || !f.alive) return;
  const mult = difficultyMult(draft, factionId);
  const owned = Object.values(draft.provinces).filter((p) => p.ownerId === factionId);

  // 省份收入
  let mil = 0;
  let civ = 0;
  for (const p of owned) {
    const def = PROVINCE_MAP[p.id]!;
    f.stockpile.oil += Math.round((def.oil ?? 0) * mult);
    f.stockpile.steel += Math.round((def.steel ?? 0) * mult);
    f.stockpile.rubber += Math.round((def.rubber ?? 0) * mult);
    f.stockpile.food += Math.round((def.food ?? 0) * mult);
    f.stockpile.manpower += Math.round(def.manpower * ECONOMY.manpowerGrowthRate * mult);
    // 工业受损（游击袭扰）：受损月内本省军民工厂产出减半，逐月恢复
    const dmg = p.damagedMonths > 0 ? 0.5 : 1;
    mil += p.factoriesMil * dmg;
    civ += p.factoriesCiv * dmg;
    if (p.damagedMonths > 0) p.damagedMonths -= 1;
  }

  // 工业产出（钢不足按比例打折）
  const steelNeed = mil * ECONOMY.steelPerMilFactory;
  const steelRatio = steelNeed === 0 ? 1 : clamp(f.stockpile.steel / steelNeed, 0, 1);
  f.stockpile.steel -= Math.round(steelNeed * steelRatio);
  const stabilityFactor = 0.7 + f.stability / 200;
  const industryTech = 1 + 0.1 * (f.tech.industry ?? 0);
  f.stockpile.equipment += Math.round(
    mil * ECONOMY.equipmentPerMilFactory * steelRatio * stabilityFactor * industryTech * mult,
  );
  f.constructionPoints += Math.round(civ * ECONOMY.constructionPerCivFactory * mult);

  // 科研
  f.researchPoints += civ * RESEARCH_PER_CIV_FACTORY;
  if (f.researchBranch) {
    const branch = TECH_BRANCHES[f.researchBranch];
    const level = f.tech[f.researchBranch] ?? 0;
    const next = branch.levels[level];
    if (next && f.researchPoints >= next.cost) {
      f.researchPoints -= next.cost;
      f.tech[f.researchBranch] = level + 1;
      if (factionId === draft.playerFactionId) {
        pushLog(draft, "economy", `科技完成：${branch.name} 升至 ${level + 1} 级（${next.name}）。`);
      }
    }
  }

  // 国策推进
  if (f.focusId) {
    f.focusMonthsLeft -= 1;
    if (f.focusMonthsLeft <= 0) {
      const def = FOCUS_MAP[f.focusId];
      if (def) {
        applyFocusEffects(draft, factionId, def.effects);
        if (factionId === draft.playerFactionId) {
          pushLog(draft, "economy", `国策完成：${def.name}。`);
        }
      }
      f.completedFocuses.push(f.focusId);
      f.focusId = null;
      f.focusMonthsLeft = 0;
    }
  }

  // 生产队列推进
  const remaining = [];
  for (const item of draft.production) {
    if (item.factionId !== factionId) {
      remaining.push(item);
      continue;
    }
    item.monthsLeft -= 1;
    if (item.monthsLeft > 0) {
      remaining.push(item);
      continue;
    }
    if (item.kind === "division" && item.templateId) {
      const tpl = TEMPLATES[item.templateId]!;
      let placeAt = item.provinceId;
      const provOwner = draft.provinces[placeAt]?.ownerId;
      if (provOwner !== factionId && !tpl.guerrilla) {
        placeAt = FACTIONS[factionId as keyof typeof FACTIONS].capitalProvinceId;
      }
      draft.divisions.push({
        id: `div-${draft.nextId++}`,
        factionId,
        templateId: item.templateId,
        provinceId: placeAt,
        strength: tpl.fullStrength,
        movedTurn: draft.turn,
        staticMonths: 0,
        org: 100,
      });
      if (factionId === draft.playerFactionId) {
        pushLog(draft, "economy", `新编成：${tpl.name} 于 ${PROVINCE_MAP[placeAt]?.name ?? placeAt} 成军（${tpl.fullStrength} 人）。`);
      }
    } else if (item.kind === "factoryMil" || item.kind === "factoryCiv") {
      const prov = draft.provinces[item.provinceId];
      if (prov && prov.ownerId === factionId) {
        if (item.kind === "factoryMil") prov.factoriesMil += 1;
        else prov.factoriesCiv += 1;
      }
    } else if (item.kind === "support" && item.supportKind) {
      let placeAt = item.provinceId;
      if (draft.provinces[placeAt]?.ownerId !== factionId) {
        placeAt = FACTIONS[factionId as keyof typeof FACTIONS].capitalProvinceId;
      }
      draft.supports.push({
        id: `sup-${draft.nextId++}`, factionId, kind: item.supportKind, provinceId: placeAt, missionTargetId: placeAt,
      });
    }
  }
  draft.production = remaining;

  // 维持与补给
  const supplied = suppliedProvinces(draft, factionId);
  for (const div of draft.divisions) {
    if (div.factionId !== factionId) continue;
    const tpl = TEMPLATES[div.templateId]!;
    if (tpl.guerrilla) continue; // 游击单位就地取给、无补给线衰减
    let decay = 0;
    if (f.stockpile.food >= tpl.supplyFood) f.stockpile.food -= tpl.supplyFood;
    else {
      f.stockpile.food = 0;
      decay += 0.05;
    }
    if (tpl.supplyOil > 0) {
      if (f.stockpile.oil >= tpl.supplyOil) f.stockpile.oil -= tpl.supplyOil;
      else decay += 0.03;
    }
    const tpDiv = TERRAIN_PARAMS[PROVINCE_MAP[div.provinceId]?.terrain ?? "plains"];
    if (!supplied.has(div.provinceId)) decay += ECONOMY.unsuppliedStrengthDecay * tpDiv.unsuppliedMult;
    else decay += tpDiv.suppliedAttrition; // 有补给也有环境损耗（丛林疾病/沙漠/沼泽/高山）
    if (decay > 0) {
      div.strength = Math.max(100, Math.floor(div.strength * (1 - decay)));
    }
  }
  for (const sup of draft.supports) {
    if (sup.factionId !== factionId) continue;
    const oilNeed = sup.kind === "fleet" ? 4 : 2;
    if (f.stockpile.oil >= oilNeed) f.stockpile.oil -= oilNeed;
  }

  // 补员（有补给的非满编师，每月最多补满编的 25%）
  for (const div of draft.divisions) {
    if (div.factionId !== factionId) continue;
    const tpl = TEMPLATES[div.templateId]!;
    if (div.strength >= tpl.fullStrength) continue;
    if (!tpl.guerrilla && !supplied.has(div.provinceId)) continue;
    const tpRec = TERRAIN_PARAMS[PROVINCE_MAP[div.provinceId]?.terrain ?? "plains"];
    const want = Math.min(tpl.fullStrength - div.strength, Math.ceil(tpl.fullStrength * 0.25 * tpRec.recoveryMult));
    const equipCost = (want / tpl.fullStrength) * tpl.equipmentCost * 0.5;
    if (f.stockpile.manpower >= want && f.stockpile.equipment >= equipCost) {
      f.stockpile.manpower -= want;
      f.stockpile.equipment -= Math.round(equipCost);
      div.strength += want;
    }
  }

  // 附庸进贡
  if (f.vassalOf) {
    const overlord = draft.factions[f.vassalOf];
    if (overlord && overlord.active && overlord.alive) {
      const eq = Math.min(f.stockpile.equipment, DIPLOMACY_RUNTIME.vassalMonthlyTribute.equipment);
      const fd = Math.min(f.stockpile.food, DIPLOMACY_RUNTIME.vassalMonthlyTribute.food);
      f.stockpile.equipment -= eq;
      f.stockpile.food -= fd;
      overlord.stockpile.equipment += eq;
      overlord.stockpile.food += fd;
    }
  }

  // 稳定度/战争支持度漂移
  f.stability = clampPercent(f.stability + Math.sign(50 - f.stability));
  if (f.stockpile.food <= 0) f.stability = clampPercent(f.stability - ECONOMY.shortageStabilityPenalty);
  const atWar = Object.keys(draft.relations).length > 0 && draft.wars.some((w) => w.includes(factionId));
  const warTarget = atWar ? 60 : 40;
  f.warSupport = clampPercent(f.warSupport + Math.sign(warTarget - f.warSupport));
}

export function settleAllFactions(draft: GameState): void {
  for (const fid of Object.keys(draft.factions)) {
    settleFaction(draft, fid);
  }
  // 静止驻扎月数累积（筹备攻势/坚守筑垒的层数来源；移动/进攻/受击时在各自结算里清零）
  // 组织度恢复也在此：上月未行动才恢复（行动月不恢复）；补给连通全额、断补给 1/4，地形恢复乘子
  const suppliedByFaction = new Map<string, Set<string>>();
  for (const d of draft.divisions) {
    const tpFort = TERRAIN_PARAMS[PROVINCE_MAP[d.provinceId]?.terrain ?? "plains"];
    d.staticMonths = Math.min(d.staticMonths + tpFort.fortGrowMult, 12);
    if (d.movedTurn < draft.turn - 1 && d.org < ORG_MAX) {
      let sup = suppliedByFaction.get(d.factionId);
      if (!sup) {
        sup = suppliedProvinces(draft, d.factionId);
        suppliedByFaction.set(d.factionId, sup);
      }
      const supMult = sup.has(d.provinceId) ? 1 : ORG_RECOVERY_UNSUPPLIED_MULT;
      d.org = Math.min(ORG_MAX, d.org + ORG_RECOVERY_BASE * tpFort.recoveryMult * supMult);
    }
  }
  // 贸易协定收益（双方各一份，交战时自动失效在宣战动作里处理）
  for (const key of draft.tradePacts) {
    const [a, b] = key.split("__");
    const fa = a ? draft.factions[a] : undefined;
    const fb = b ? draft.factions[b] : undefined;
    if (fa && fb && fa.active && fa.alive && fb.active && fb.alive) {
      fa.stockpile.equipment += DIPLOMACY_RUNTIME.tradeMonthlyGain.equipment;
      fa.stockpile.steel += DIPLOMACY_RUNTIME.tradeMonthlyGain.steel;
      fb.stockpile.equipment += DIPLOMACY_RUNTIME.tradeMonthlyGain.equipment;
      fb.stockpile.steel += DIPLOMACY_RUNTIME.tradeMonthlyGain.steel;
    }
  }
  // 出局判定：无省份且无部队
  for (const f of Object.values(draft.factions)) {
    if (!f.active || !f.alive) continue;
    const hasProvince = Object.values(draft.provinces).some((p) => p.ownerId === f.id);
    const hasDivision = draft.divisions.some((d) => d.factionId === f.id);
    if (!hasProvince && !hasDivision) {
      f.alive = false;
      pushLog(draft, "system", `${FACTIONS[f.id as keyof typeof FACTIONS]?.name ?? f.id} 已出局（失去全部省份与部队）。`);
    }
  }
}
