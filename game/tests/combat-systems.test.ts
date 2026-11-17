// 攻击玩法重做一期验收：模式拆回系统——筹备/包围/渗透/矛头/空优全自动判定。
import { describe, it, expect } from "vitest";
import { createInitialState } from "../src/state/createInitialState";
import { applyAction } from "../src/core/applyAction";
import { estimateAttack } from "../src/core/combat";
import { relationPairKey } from "../src/data/diplomacy";
import { serializeSave, deserializeSave } from "../src/save/saveGame";
import { TEMPLATES } from "../src/data/units";
import type { GameState } from "../src/state/types";

function clone(s: GameState): GameState {
  return structuredClone(s);
}

function mkDiv(id: string, factionId: string, templateId: string, provinceId: string, strength?: number, extra: object = {}) {
  const tpl = TEMPLATES[templateId]!;
  return {
    id, factionId, templateId, provinceId,
    strength: strength ?? tpl.fullStrength, movedTurn: -1, staticMonths: 0, org: 100, ...extra,
  };
}

/** 战场底盘：清空华北几省驻军，日 roc 交战，roc 在石家庄、japan 在太原/保定。 */
function arena() {
  const s = createInitialState({ seed: 5, playerFactionId: "roc" });
  const draft = clone(s);
  draft.wars.push(relationPairKey("japan", "roc"));
  draft.divisions = draft.divisions.filter(
    (d) => !["shijiazhuang", "beiping", "baoding", "datong", "taiyuan", "zhengzhou", "xian", "yanan"].includes(d.provinceId),
  );
  return draft;
}

describe("筹备自动结算（原筹备攻势模式）", () => {
  it("静止 3 层参战：预估带「筹备 +36%」、战力比高于无筹备", () => {
    const draft = arena();
    draft.divisions.push(mkDiv("p-1", "roc", "infantry", "shijiazhuang", 10000, { staticMonths: 3 }));
    draft.divisions.push(mkDiv("p-d", "japan", "infantry_jp", "baoding"));
    const estPrep = estimateAttack(draft, "roc", ["p-1"], "baoding")!;
    expect(estPrep.modifiers.some((m) => m.includes("筹备 +36%"))).toBe(true);
    const draft2 = arena();
    draft2.divisions.push(mkDiv("p-1", "roc", "infantry", "shijiazhuang"));
    draft2.divisions.push(mkDiv("p-d", "japan", "infantry_jp", "baoding"));
    const estPlain = estimateAttack(draft2, "roc", ["p-1"], "baoding")!;
    expect(estPrep.ratio).toBeGreaterThan(estPlain.ratio);
  });
});

describe("包围自动判定（原包围模式）", () => {
  it("孤省守军：预估 targetSupplied=false 且带包围修正行；获胜后守军全歼不撤退", () => {
    const draft = arena();
    // 太原的补给靠大同/石家庄方向——把太原周边全划给 roc，只留太原给 japan 造孤省
    for (const pid of ["datong", "shijiazhuang", "zhengzhou", "xian", "yanan"]) {
      draft.provinces[pid]!.ownerId = "roc";
    }
    draft.provinces["taiyuan"]!.ownerId = "japan";
    draft.divisions.push(mkDiv("e-a1", "roc", "armor", "shijiazhuang"));
    draft.divisions.push(mkDiv("e-a2", "roc", "armor", "shijiazhuang"));
    draft.divisions.push(mkDiv("e-a3", "roc", "armor", "datong"));
    draft.divisions.push(mkDiv("e-d1", "japan", "infantry_jp", "taiyuan", 2000));
    const est = estimateAttack(draft, "roc", ["e-a1", "e-a2"], "taiyuan")!;
    expect(est.targetSupplied).toBe(false);
    expect(est.modifiers.some((m) => m.includes("补给已断绝"))).toBe(true);
    const res = applyAction(draft, {
      type: "ATTACK", factionId: "roc", divisionIds: ["e-a1", "e-a2", "e-a3"], targetProvinceId: "taiyuan",
    });
    expect(res.error).toBeNull();
    expect(res.state.provinces["taiyuan"]!.ownerId).toBe("roc");
    // 守军全歼：e-d1 不复存在（不是撤退到邻省）
    expect(res.state.divisions.some((d) => d.id === "e-d1")).toBe(false);
  });

  it("补给连通的目标：targetSupplied=true、无包围行", () => {
    const draft = arena();
    draft.divisions.push(mkDiv("e-b1", "roc", "infantry", "shijiazhuang"));
    draft.divisions.push(mkDiv("e-bd", "japan", "infantry_jp", "baoding"));
    const est = estimateAttack(draft, "roc", ["e-b1"], "baoding")!;
    expect(est.targetSupplied).toBe(true);
    expect(est.modifiers.some((m) => m.includes("补给已断绝"))).toBe(false);
  });
});

describe("渗透自动触发（原渗透模式）", () => {
  it("山地目标＋特性师兵力过半：infiltrationActive 且战力比更高；普通步兵同兵力不触发", () => {
    const draft = arena();
    draft.divisions.push(mkDiv("i-1", "roc", "mountain", "datong")); // 太原为山地
    draft.divisions.push(mkDiv("i-d", "japan", "infantry_jp", "taiyuan"));
    const estInf = estimateAttack(draft, "roc", ["i-1"], "taiyuan")!;
    expect(estInf.infiltrationActive).toBe(true);
    expect(estInf.modifiers.some((m) => m.includes("渗透"))).toBe(true);
    const draft2 = arena();
    draft2.divisions.push(mkDiv("i-1", "roc", "infantry", "datong", 8000)); // 与山地师同兵力
    draft2.divisions.push(mkDiv("i-d", "japan", "infantry_jp", "taiyuan"));
    const estPlain = estimateAttack(draft2, "roc", ["i-1"], "taiyuan")!;
    expect(estPlain.infiltrationActive).toBe(false);
    expect(estInf.ratio).toBeGreaterThan(estPlain.ratio);
  });

  it("特性师占比不足一半不触发（混编稀释）", () => {
    const draft = arena();
    draft.divisions.push(mkDiv("i-m1", "roc", "mountain", "datong", 4000));
    draft.divisions.push(mkDiv("i-m2", "roc", "infantry", "datong", 10000));
    draft.divisions.push(mkDiv("i-d", "japan", "infantry_jp", "taiyuan"));
    const est = estimateAttack(draft, "roc", ["i-m1", "i-m2"], "taiyuan")!;
    expect(est.infiltrationActive).toBe(false);
  });
});

describe("矛头指定", () => {
  it("带矛头预估战力比高于不带；矛头校验：超限与非参战都回错", () => {
    const draft = arena();
    draft.divisions.push(mkDiv("s-1", "roc", "armor", "shijiazhuang"));
    draft.divisions.push(mkDiv("s-2", "roc", "infantry", "shijiazhuang"));
    draft.divisions.push(mkDiv("s-d", "japan", "infantry_jp", "baoding"));
    const plain = estimateAttack(draft, "roc", ["s-1", "s-2"], "baoding")!;
    const spear = estimateAttack(draft, "roc", ["s-1", "s-2"], "baoding", [], ["s-1"])!;
    expect(spear.spearheadCount).toBe(1);
    expect(spear.ratio).toBeGreaterThan(plain.ratio);
    const tooMany = applyAction(draft, {
      type: "ATTACK", factionId: "roc", divisionIds: ["s-1", "s-2"], targetProvinceId: "baoding",
      spearheadIds: ["s-1", "s-2", "s-x"],
    });
    expect(tooMany.error).toBe("SPEARHEAD_LIMIT");
    const notInForce = applyAction(draft, {
      type: "ATTACK", factionId: "roc", divisionIds: ["s-1"], targetProvinceId: "baoding",
      spearheadIds: ["s-2"],
    });
    expect(notInForce.error).toBe("SPEARHEAD_NOT_IN_FORCE");
  });
});

describe("空军任务系统（二期：任务口径替代在场口径）", () => {
  it("战斗机任务指向目标省 → 空优我方；未指派（缺省驻扎省）→ 无空优行", () => {
    const draft = arena();
    draft.divisions.push(mkDiv("a-1", "roc", "infantry", "shijiazhuang"));
    draft.divisions.push(mkDiv("a-d", "japan", "infantry_jp", "baoding"));
    draft.supports.push({ id: "sup-f1", factionId: "roc", kind: "fighter", provinceId: "shijiazhuang", missionTargetId: "shijiazhuang" });
    const est0 = estimateAttack(draft, "roc", ["a-1"], "baoding")!;
    expect(est0.modifiers.some((m) => m.includes("空优"))).toBe(false); // 缺省任务=驻扎省，不罩邻省战场
    const r = applyAction(draft, { type: "SET_SUPPORT_MISSION", factionId: "roc", supportId: "sup-f1", targetProvinceId: "baoding" });
    expect(r.error).toBeNull();
    const est = estimateAttack(r.state, "roc", ["a-1"], "baoding")!;
    expect(est.modifiers.some((m) => m.includes("空优 我方"))).toBe(true);
  });

  it("守方战斗机任务指向被攻省 → 空优争夺；轰炸机任务指向 → 对地支援", () => {
    const draft = arena();
    draft.divisions.push(mkDiv("a-1", "roc", "infantry", "shijiazhuang"));
    draft.divisions.push(mkDiv("a-d", "japan", "infantry_jp", "baoding"));
    draft.supports.push({ id: "sup-f1", factionId: "roc", kind: "fighter", provinceId: "shijiazhuang", missionTargetId: "baoding" });
    draft.supports.push({ id: "sup-f2", factionId: "japan", kind: "fighter", provinceId: "baoding", missionTargetId: "baoding" });
    draft.supports.push({ id: "sup-b1", factionId: "roc", kind: "bomber", provinceId: "shijiazhuang", missionTargetId: "baoding" });
    const est = estimateAttack(draft, "roc", ["a-1"], "baoding")!;
    expect(est.modifiers.some((m) => m.includes("空优 争夺中"))).toBe(true);
    expect(est.modifiers.some((m) => m.includes("对地支援"))).toBe(true);
  });

  it("SET_SUPPORT_MISSION 校验：他人单位/未知单位拒绝", () => {
    const draft = arena();
    draft.supports.push({ id: "sup-f9", factionId: "japan", kind: "fighter", provinceId: "baoding", missionTargetId: "baoding" });
    const r1 = applyAction(draft, { type: "SET_SUPPORT_MISSION", factionId: "roc", supportId: "sup-f9", targetProvinceId: "xian" });
    expect(r1.error).toBe("SUPPORT_NOT_OWNED");
    const r2 = applyAction(draft, { type: "SET_SUPPORT_MISSION", factionId: "roc", supportId: "nope", targetProvinceId: "xian" });
    expect(r2.error).toBe("UNKNOWN_SUPPORT: nope");
  });

  it("v5 存档迁移：支援单位补 missionTargetId=驻扎省、版本升现行", () => {
    const s = createInitialState({ seed: 3, playerFactionId: "roc" });
    const raw = JSON.parse(serializeSave(s)) as { state: Record<string, unknown> };
    raw.state.version = 5;
    for (const sp of raw.state.supports as Array<Record<string, unknown>>) delete sp.missionTargetId;
    const loaded = deserializeSave(JSON.stringify(raw));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state.version).toBe(7);
      expect(loaded.state.supports.every((x) => x.missionTargetId === x.provinceId)).toBe(true);
    }
  });
});

describe("C5 战斗标记（引擎落账）", () => {
  it("普通战斗落 battle、孤省全歼落 encircle、袭扰落 raid", () => {
    const draft = arena();
    draft.divisions.push(mkDiv("m-1", "roc", "infantry", "shijiazhuang"));
    draft.divisions.push(mkDiv("m-d", "japan", "infantry_jp", "baoding"));
    const r1 = applyAction(draft, { type: "ATTACK", factionId: "roc", divisionIds: ["m-1"], targetProvinceId: "baoding" });
    expect(r1.error).toBeNull();
    expect(r1.state.combatMarks.find((m) => m.provinceId === "baoding")?.kind).toBe("battle");

    const d2 = arena();
    for (const pid of ["datong", "shijiazhuang", "zhengzhou", "xian", "yanan"]) d2.provinces[pid]!.ownerId = "roc";
    d2.provinces["taiyuan"]!.ownerId = "japan";
    d2.divisions.push(mkDiv("m-a1", "roc", "armor", "shijiazhuang"));
    d2.divisions.push(mkDiv("m-a2", "roc", "armor", "shijiazhuang"));
    d2.divisions.push(mkDiv("m-a3", "roc", "armor", "datong"));
    d2.divisions.push(mkDiv("m-d1", "japan", "infantry_jp", "taiyuan", 2000));
    const r2 = applyAction(d2, { type: "ATTACK", factionId: "roc", divisionIds: ["m-a1", "m-a2", "m-a3"], targetProvinceId: "taiyuan" });
    expect(r2.error).toBeNull();
    expect(r2.state.combatMarks.find((m) => m.provinceId === "taiyuan")?.kind).toBe("encircle");

    const d3 = arena();
    d3.divisions.push(mkDiv("m-g1", "ccp", "eighthRoute", "yanan"));
    if (!d3.wars.some((w) => w.includes("ccp") && w.includes("roc"))) d3.wars.push(relationPairKey("ccp", "roc"));
    const r3 = applyAction(d3, { type: "RAID", factionId: "ccp", divisionIds: ["m-g1"], targetProvinceId: "xian" });
    expect(r3.error).toBeNull();
    expect(r3.state.combatMarks.find((m) => m.provinceId === "xian")?.kind).toBe("raid");
  });

  it("跨海进攻落 landing 标记；打断补给飞地优先落 encircle", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "thailand" });
    const draft = clone(s);
    draft.wars.push(relationPairKey("japan", "roc"));
    // 长崎 teleport 一个日本师团跨海打上海（上海在 roc 补给网内）→ landing
    const nag = draft.divisions.find((d) => d.factionId === "japan")!;
    nag.provinceId = "nagasaki";
    // 三期项目制：筹备 → 次月执行
    const prep = applyAction(draft, { type: "PREPARE_LANDING", factionId: "japan", divisionIds: [nag.id], fromProvinceId: "nagasaki", targetProvinceId: "shanghai" });
    expect(prep.error).toBeNull();
    const nm = clone(prep.state);
    nm.turn += 1;
    const res = applyAction(nm, { type: "EXECUTE_LANDING", factionId: "japan", planId: prep.state.landingPlans[0]!.id });
    expect(res.error).toBeNull();
    expect(res.state.combatMarks.find((m) => m.provinceId === "shanghai")?.kind).toBe("landing");
    // 大连打天津：天津/北平是被军阀省隔断的 roc 飞地、本就断补给 → 包围优先于登陆
    const draft2 = clone(s);
    draft2.wars.push(relationPairKey("japan", "roc"));
    const dalianIds = draft2.divisions.filter((d) => d.factionId === "japan" && d.provinceId === "dalian").map((d) => d.id);
    const prep2 = applyAction(draft2, { type: "PREPARE_LANDING", factionId: "japan", divisionIds: dalianIds, fromProvinceId: "dalian", targetProvinceId: "tianjin" });
    expect(prep2.error).toBeNull();
    const nm2 = clone(prep2.state);
    nm2.turn += 1;
    const res2 = applyAction(nm2, { type: "EXECUTE_LANDING", factionId: "japan", planId: prep2.state.landingPlans[0]!.id });
    expect(res2.error).toBeNull();
    expect(res2.state.combatMarks.find((m) => m.provinceId === "tianjin")?.kind).toBe("encircle");
  });

  it("END_TURN 清理：上回合标记清除、本回合保留", () => {
    const draft = arena();
    draft.combatMarks = [
      { provinceId: "baoding", kind: "battle", turn: draft.turn - 1 },
      { provinceId: "taiyuan", kind: "battle", turn: draft.turn },
    ];
    const res = applyAction(draft, { type: "END_TURN" });
    expect(res.error).toBeNull();
    expect(res.state.combatMarks.some((m) => m.provinceId === "baoding")).toBe(false);
    expect(res.state.combatMarks.some((m) => m.provinceId === "taiyuan")).toBe(true);
  });
});

describe("AI 空军任务指派（二期）", () => {
  it("AI 进攻前先把战斗机任务改派到主攻目标省（动作序：MISSION 在 ATTACK 之前）", async () => {
    const { planAiActions } = await import("../src/ai/ai");
    const draft = arena();
    // 中共（与 roc 交战中）在延安有正规步兵师（非游击，走 ATTACK 而非 RAID），西安为 roc 省
    draft.divisions.push(mkDiv("ai-1", "ccp", "infantry", "yanan", 10000));
    draft.supports.push({ id: "sup-ai", factionId: "ccp", kind: "fighter", provinceId: "yanan", missionTargetId: "yanan" });
    const actions = planAiActions(draft, "ccp");
    const atkIdx = actions.findIndex((a) => a.type === "ATTACK");
    expect(atkIdx).toBeGreaterThanOrEqual(0);
    const atk = actions[atkIdx] as unknown as { targetProvinceId: string };
    expect(atk.targetProvinceId).toBe("xian");
    const misIdx = actions.findIndex((a) => a.type === "SET_SUPPORT_MISSION");
    expect(misIdx).toBeGreaterThanOrEqual(0);
    expect(misIdx).toBeLessThan(atkIdx);
    const mis = actions[misIdx] as unknown as { supportId: string; targetProvinceId: string };
    expect(mis.supportId).toBe("sup-ai");
    expect(mis.targetProvinceId).toBe("xian");
  });
});

describe("登陆项目制（三期）", () => {
  it("筹备锁定：参战师行军/进攻回 LANDING_LOCKED；取消后解锁但当月行动不恢复", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "thailand" });
    const draft = clone(s);
    draft.wars.push(relationPairKey("japan", "roc"));
    const dalianIds = draft.divisions.filter((d) => d.factionId === "japan" && d.provinceId === "dalian").map((d) => d.id);
    const prep = applyAction(draft, { type: "PREPARE_LANDING", factionId: "japan", divisionIds: dalianIds, fromProvinceId: "dalian", targetProvinceId: "tianjin" });
    expect(prep.error).toBeNull();
    const mv = applyAction(prep.state, { type: "MOVE_UNITS", factionId: "japan", divisionIds: [dalianIds[0]!], toProvinceId: "shenyang" });
    expect(mv.error).toBe("LANDING_LOCKED");
    const cancel = applyAction(prep.state, { type: "CANCEL_LANDING", factionId: "japan", planId: prep.state.landingPlans[0]!.id });
    expect(cancel.error).toBeNull();
    expect(cancel.state.landingPlans).toHaveLength(0);
    const mv2 = applyAction(cancel.state, { type: "MOVE_UNITS", factionId: "japan", divisionIds: [dalianIds[0]!], toProvinceId: "shenyang" });
    expect(mv2.error).toBe("DIVISION_ALREADY_ACTED"); // 已解锁（不再是 LANDING_LOCKED），但筹备消耗的当月行动不恢复
  });

  it("计划过期月结自动取消（玩家计划不被 AI 代执行）", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const draft = clone(s);
    draft.wars.push(relationPairKey("roc", "japan"));
    const div = draft.divisions.find((d) => d.factionId === "roc")!;
    div.provinceId = "shanghai"; // roc 港口
    const prep = applyAction(draft, { type: "PREPARE_LANDING", factionId: "roc", divisionIds: [div.id], fromProvinceId: "shanghai", targetProvinceId: "nagasaki" });
    expect(prep.error).toBeNull();
    let st = prep.state;
    st = applyAction(st, { type: "END_TURN" }).state; // 到 readyTurn 月：玩家计划仍在（可执行；AI 自家计划不计）
    expect(st.landingPlans.filter((p) => p.factionId === "roc")).toHaveLength(1);
    st = applyAction(st, { type: "END_TURN" }).state; // 过期：月结自动取消
    expect(st.landingPlans.filter((p) => p.factionId === "roc")).toHaveLength(0);
  });
});

describe("突破追击（三期）", () => {
  it("步兵决胜也不追击（无合格兵种）：主攻停在占领省", () => {
    const draft = arena();
    draft.wars.push(relationPairKey("roc", "warlords")); // 保定属军阀，占领须对省主交战
    draft.divisions.push(mkDiv("p-1", "roc", "infantry", "shijiazhuang"));
    draft.divisions.push(mkDiv("p-2", "roc", "infantry", "shijiazhuang"));
    draft.divisions.push(mkDiv("p-d", "japan", "infantry_jp", "baoding", 1200));
    const r = applyAction(draft, { type: "ATTACK", factionId: "roc", divisionIds: ["p-1", "p-2"], targetProvinceId: "baoding" });
    expect(r.error).toBeNull();
    expect(r.state.provinces["baoding"]!.ownerId).toBe("roc");
    expect(r.state.divisions.find((d) => d.id === "p-1")!.provinceId).toBe("baoding");
    const log = r.state.log.filter((l) => l.kind === "battle").at(-1)!;
    expect(log.text).not.toContain("追击");
  });
});
