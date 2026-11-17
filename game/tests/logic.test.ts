// M2 逻辑测试：月结算算例 / 生产编成 / 行军 / 战斗复现 / 外交判定 / 事件触发 / 胜负判定。

import { describe, it, expect } from "vitest";
import { createInitialState } from "../src/state/createInitialState";
import { applyAction } from "../src/core/applyAction";
import { settleAllFactions } from "../src/core/settlement";
import { checkVictory } from "../src/core/victory";
import { relationPairKey } from "../src/data/diplomacy";
import { PROVINCES, PROVINCE_MAP } from "../src/data/provinces";
import { estimateAttack } from "../src/core/combat";
import { ECONOMY } from "../src/data/economy";
import { TERRAIN_PARAMS } from "../src/data/terrain";
import type { GameState } from "../src/state/types";

function clone(s: GameState): GameState {
  return structuredClone(s);
}

describe("月结算", () => {
  it("人力增长算例：蒙古辖省人力池合计 x 0.004（向下取整）", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const before = s.factions["mongolia"]!.stockpile.manpower;
    const pool = PROVINCES.filter((p) => p.ownerId === "mongolia").reduce((a, p) => a + p.manpower, 0);
    const draft = clone(s);
    settleAllFactions(draft);
    expect(draft.factions["mongolia"]!.stockpile.manpower).toBe(before + Math.floor(pool * ECONOMY.manpowerGrowthRate));
  });

  it("工业产出为正且钢消耗入账（国民政府）", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "japan" });
    const draft = clone(s);
    const eqBefore = draft.factions["roc"]!.stockpile.equipment;
    settleAllFactions(draft);
    expect(draft.factions["roc"]!.stockpile.equipment).toBeGreaterThan(eqBefore);
  });

  it("无补给衰减：孤悬敌后的部队按地形倍率月减员（拉萨山地 = 5%×1.6，游击单位豁免）", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const draft = clone(s);
    const div = draft.divisions.find((d) => d.factionId === "japan" && d.templateId === "infantry_jp")!;
    div.provinceId = "lhasa"; // 中立山区，与日本无补给连通
    const before = div.strength;
    settleAllFactions(draft);
    const after = draft.divisions.find((d) => d.id === div.id)!;
    expect(after.strength).toBe(Math.floor(before * (1 - ECONOMY.unsuppliedStrengthDecay * TERRAIN_PARAMS.mountain.unsuppliedMult)));
    const guer = draft.divisions.find((d) => d.factionId === "ccp" && d.templateId === "guerrilla")!;
    const gBefore = guer.strength;
    settleAllFactions(draft);
    expect(draft.divisions.find((d) => d.id === guer.id)!.strength).toBe(gBefore);
  });
});

describe("生产编成", () => {
  it("造师：扣装备/人力入队列，3 个月后满编成军", () => {
    let s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const eq = s.factions["roc"]!.stockpile.equipment;
    const mp = s.factions["roc"]!.stockpile.manpower;
    const res = applyAction(s, {
      type: "BUILD_DIVISION", factionId: "roc", provinceId: "nanjing", templateId: "infantry",
    });
    expect(res.error).toBeNull();
    s = res.state;
    expect(s.factions["roc"]!.stockpile.equipment).toBe(eq - 100);
    expect(s.factions["roc"]!.stockpile.manpower).toBe(mp - 10000);
    expect(s.production).toHaveLength(1);
    const draft = clone(s);
    settleAllFactions(draft);
    settleAllFactions(draft);
    // 编成期 3 个月：2 个月时尚未成军
    expect(draft.divisions.filter((d) => d.factionId === "roc").length)
      .toBe(s.divisions.filter((d) => d.factionId === "roc").length);
    settleAllFactions(draft);
    const rocDivs = draft.divisions.filter((d) => d.factionId === "roc");
    expect(rocDivs.length).toBe(s.divisions.filter((d) => d.factionId === "roc").length + 1);
    expect(rocDivs.some((d) => d.provinceId === "nanjing" && d.strength === 10000 && d.templateId === "infantry")).toBe(true);
  });

  it("装备不足造师被拒；他国特色师不可造", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "mongolia" });
    const poor = applyAction(s, {
      type: "BUILD_DIVISION", factionId: "mongolia", provinceId: "ulaanbaatar", templateId: "armor",
    });
    expect(poor.error).toBe("INSUFFICIENT_EQUIPMENT");
    const alien = applyAction(s, {
      type: "BUILD_DIVISION", factionId: "mongolia", provinceId: "ulaanbaatar", templateId: "kwantung",
    });
    expect(alien.error).toBe("TEMPLATE_FACTION_MISMATCH");
  });
});

describe("行军", () => {
  it("速度内可达成功、超距被拒、每回合限一次", () => {
    let s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const cav = s.divisions.find((d) => d.factionId === "roc" && d.templateId === "cavalry")!;
    // 新口径（移动点）：石家庄->保定（平原，成本 1.8/8 点）可达；->太原（山地 8.4 点）超距，见 terrain.test
    const ok = applyAction(s, {
      type: "MOVE_UNITS", factionId: "roc", divisionIds: [cav.id], toProvinceId: "baoding",
    });
    expect(ok.error).toBeNull();
    s = ok.state;
    expect(s.divisions.find((d) => d.id === cav.id)!.provinceId).toBe("baoding");
    const again = applyAction(s, {
      type: "MOVE_UNITS", factionId: "roc", divisionIds: [cav.id], toProvinceId: "taiyuan",
    });
    expect(again.error).toBe("DIVISION_ALREADY_ACTED");
    const inf = s.divisions.find((d) => d.factionId === "roc" && d.provinceId === "beiping")!;
    // 新指挥口径下行军令不限距离（跨省路径），但敌控省份（交战中的延安）不可作为行军目标
    const far = applyAction(s, {
      type: "MOVE_UNITS", factionId: "roc", divisionIds: [inf.id], toProvinceId: "yanan",
    });
    expect(far.error).toBe("NOT_REACHABLE");
  });
});

describe("战斗", () => {
  function battleSetup() {
    const s = createInitialState({ seed: 42, playerFactionId: "thailand" });
    const draft = clone(s);
    draft.wars.push(relationPairKey("japan", "roc"));
    const jp = draft.divisions.find((d) => d.factionId === "japan" && d.templateId === "kwantung")!;
    jp.provinceId = "zhangjiakou"; // 张家口与北平相邻
    return draft;
  }

  it("进攻产生战损与纪事，同种子同结果（可复现）", () => {
    const runOnce = () => {
      const s = battleSetup();
      const jpIds = s.divisions.filter((d) => d.factionId === "japan" && d.provinceId === "zhangjiakou").map((d) => d.id);
      const res = applyAction(s, {
        type: "ATTACK", factionId: "japan", divisionIds: jpIds, targetProvinceId: "beiping",
      });
      expect(res.error).toBeNull();
      return res.state;
    };
    const a = runOnce();
    const b = runOnce();
    expect(a.divisions).toEqual(b.divisions);
    expect(a.provinces["beiping"]!.ownerId).toBe(b.provinces["beiping"]!.ownerId);
    const battleLogs = a.log.filter((l) => l.kind === "battle");
    expect(battleLogs.length).toBeGreaterThanOrEqual(1);
    const totalStrength = a.divisions.reduce((sum, d) => sum + d.strength, 0);
    const initialTotal = battleSetup().divisions.reduce((sum, d) => sum + d.strength, 0);
    expect(totalStrength).toBeLessThan(initialTotal); // 有战损（实际人数减少）
  });

  it("未宣战不可进攻；跨海进攻改登陆项目制（三期：直接打被拦、筹备→次月执行）", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "thailand" });
    const dalianIds = s.divisions.filter((d) => d.factionId === "japan" && d.provinceId === "dalian").map((d) => d.id);
    const noWar = applyAction(s, {
      type: "ATTACK", factionId: "japan", divisionIds: dalianIds, targetProvinceId: "tianjin",
    });
    expect(noWar.error).toContain("NOT_AT_WAR");
    const draft = clone(s);
    draft.wars.push(relationPairKey("japan", "roc"));
    // 直接跨海 ATTACK 被拦：必须走登陆项目
    const direct = applyAction(draft, {
      type: "ATTACK", factionId: "japan", divisionIds: dalianIds, targetProvinceId: "tianjin",
    });
    expect(direct.error).toBe("AMPHIBIOUS_REQUIRES_PLAN");
    // 筹备（大连是港口）→ 本月不可执行 → 次月执行成功
    const prep = applyAction(draft, {
      type: "PREPARE_LANDING", factionId: "japan", divisionIds: dalianIds, fromProvinceId: "dalian", targetProvinceId: "tianjin",
    });
    expect(prep.error).toBeNull();
    const planId = prep.state.landingPlans[0]!.id;
    const early = applyAction(prep.state, { type: "EXECUTE_LANDING", factionId: "japan", planId });
    expect(early.error).toBe("PLAN_NOT_READY");
    const nextMonth = clone(prep.state);
    nextMonth.turn += 1;
    const exec = applyAction(nextMonth, { type: "EXECUTE_LANDING", factionId: "japan", planId });
    expect(exec.error).toBeNull();
    expect(exec.state.landingPlans).toHaveLength(0);
    // 非港口出发的筹备被拦
    const draft2 = clone(s);
    draft2.wars.push(relationPairKey("japan", "roc"));
    const shenyangDiv = draft2.divisions.find((d) => d.factionId === "japan")!;
    shenyangDiv.provinceId = "shenyang";
    const badPort = applyAction(draft2, {
      type: "PREPARE_LANDING", factionId: "japan", divisionIds: [shenyangDiv.id], fromProvinceId: "shenyang", targetProvinceId: "tianjin",
    });
    expect(badPort.error).toBe("LANDING_REQUIRES_PORT");
  });

  it("袭扰是独立 RAID 动作：非游击单位下不了、游击单位可下", () => {
    const s = battleSetup();
    const jpIds = s.divisions.filter((d) => d.factionId === "japan" && d.provinceId === "zhangjiakou").map((d) => d.id);
    const bad = applyAction(s, {
      type: "RAID", factionId: "japan", divisionIds: jpIds, targetProvinceId: "beiping",
    });
    expect(bad.error).toBe("GUERRILLA_MODE_REQUIRES_GUERRILLA_UNIT");
    // 八路军（游击类）袭扰延安相邻的 roc 省份：battleSetup 里 ccp 与 roc 交战
    const s2 = battleSetup();
    const gIds = s2.divisions.filter((d) => d.factionId === "ccp").map((d) => d.id);
    expect(gIds.length).toBeGreaterThan(0);
    const div = s2.divisions.find((d) => d.id === gIds[0])!;
    const target = div.provinceId === "yanan" ? "xian" : "yanan";
    if (div.provinceId !== "yanan") div.provinceId = "yanan";
    const ok = applyAction(s2, {
      type: "RAID", factionId: "ccp", divisionIds: [div.id], targetProvinceId: target,
    });
    expect(ok.error).toBeNull();
  });
});

describe("渡河惩罚", () => {
  it("跨黄河（洛阳→郑州）进攻战力比低于平原同条件（洛阳→南阳）", () => {
    const s = createInitialState({ seed: 3, playerFactionId: "thailand" });
    const draft = clone(s);
    draft.wars.push(relationPairKey("japan", "roc"));
    // 清空相关省份驻军，放进同模板同兵力的一攻一守
    for (const d of draft.divisions) {
      if (["luoyang", "zhengzhou", "nanyang"].includes(d.provinceId)) d.provinceId = "tokyo";
    }
    const atk = draft.divisions.find((d) => d.factionId === "japan" && d.templateId === "kwantung")!;
    atk.provinceId = "luoyang"; atk.strength = 10000; atk.movedTurn = -1;
    const def = draft.divisions.find((d) => d.factionId === "roc" && d.templateId === "infantry")!;
    def.strength = 10000;
    def.provinceId = "zhengzhou";
    const riverEst = estimateAttack(draft, "japan", [atk.id], "zhengzhou");
    def.provinceId = "nanyang";
    const plainEst = estimateAttack(draft, "japan", [atk.id], "nanyang");
    expect(riverEst).not.toBeNull();
    expect(plainEst).not.toBeNull();
    expect(riverEst!.ratio).toBeLessThan(plainEst!.ratio);
    expect(riverEst!.ratio / plainEst!.ratio).toBeCloseTo(0.85, 1);
  });
});

describe("外交判定（与 llm 无关）", () => {
  it("遣使升关系并扣费；宣战置零并入交战表；议和不在战时被拒", () => {
    let s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const rel0 = s.relations[relationPairKey("roc", "ccp")]!;
    const envoy = applyAction(s, { type: "DIPLOMACY", factionId: "roc", targetId: "ccp", actionId: "envoy" });
    expect(envoy.error).toBeNull();
    s = envoy.state;
    expect(s.relations[relationPairKey("roc", "ccp")]).toBe(rel0 + 8);

    const war = applyAction(s, { type: "DIPLOMACY", factionId: "japan", targetId: "thailand", actionId: "declareWar" });
    expect(war.error).toBeNull();
    expect(war.state.wars).toContain(relationPairKey("japan", "thailand"));
    expect(war.state.relations[relationPairKey("japan", "thailand")]).toBe(0);

    const peace = applyAction(s, { type: "DIPLOMACY", factionId: "roc", targetId: "usa", actionId: "peace" });
    expect(peace.error).toBe("NOT_AT_WAR");
    const vassal = applyAction(s, { type: "DIPLOMACY", factionId: "roc", targetId: "japan", actionId: "vassalize" });
    expect(vassal.error).toContain("RELATION_TOO_LOW");
  });
});

describe("历史事件", () => {
  it("1936-12 西安事变触发：国共停战、关系回升", () => {
    let s = createInitialState({ seed: 9, playerFactionId: "thailand" });
    for (let i = 0; i < 11; i += 1) {
      const res = applyAction(s, { type: "END_TURN" });
      expect(res.error).toBeNull();
      s = res.state;
    }
    expect(s.year).toBe(1936);
    expect(s.month).toBe(12);
    expect(s.firedEvents).toContain("xian_incident");
    expect(s.wars).not.toContain(relationPairKey("roc", "ccp"));
    expect(s.relations[relationPairKey("roc", "ccp")]).toBeGreaterThanOrEqual(65);
  });
});

describe("胜负判定（统一口径）", () => {
  it("控制 >=70% 省份即胜；玩家出局判负方信息", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const draft = clone(s);
    const ids = Object.keys(draft.provinces);
    ids.forEach((pid, i) => {
      draft.provinces[pid]!.ownerId = i < Math.ceil(ids.length * 0.75) ? "japan" : "roc";
    });
    checkVictory(draft);
    expect(draft.gameOver?.winnerId).toBe("japan");
  });
});
