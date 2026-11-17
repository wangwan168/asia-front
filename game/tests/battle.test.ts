// 持续战斗验收：支援进攻不进驻、预备队递补、组织度消耗/恢复/门槛、多方向一场、战报阶段与修正、v3 迁移。
import { describe, it, expect } from "vitest";
import { createInitialState } from "../src/state/createInitialState";
import { applyAction } from "../src/core/applyAction";
import { estimateAttack } from "../src/core/combat";
import { settleAllFactions } from "../src/core/settlement";
import { relationPairKey } from "../src/data/diplomacy";
import { TEMPLATES } from "../src/data/units";
import { serializeSave, deserializeSave } from "../src/save/saveGame";
import type { GameState } from "../src/state/types";

function clone(s: GameState): GameState {
  return structuredClone(s);
}

function mkDiv(id: string, factionId: string, templateId: string, provinceId: string, strength?: number) {
  const tpl = TEMPLATES[templateId]!;
  return {
    id, factionId, templateId, provinceId,
    strength: strength ?? tpl.fullStrength, movedTurn: -1, staticMonths: 0, org: 100,
  };
}

function baseWar() {
  const s = createInitialState({ seed: 5, playerFactionId: "roc" });
  const draft = clone(s);
  draft.wars.push(relationPairKey("japan", "roc"));
  draft.divisions = draft.divisions.filter(
    (d) => !["shijiazhuang", "beiping", "baoding", "datong", "taiyuan", "zhengzhou"].includes(d.provinceId),
  );
  return draft;
}

describe("支援进攻", () => {
  it("支援部队参战加火力但不离开本省、不跟着占领；主攻进驻", () => {
    const draft = baseWar();
    draft.divisions.push(mkDiv("b-a1", "roc", "armor", "shijiazhuang"));
    draft.divisions.push(mkDiv("b-a2", "roc", "armor", "shijiazhuang"));
    draft.divisions.push(mkDiv("b-s1", "roc", "armor", "beiping"));
    draft.divisions.push(mkDiv("b-d1", "japan", "infantry_jp", "baoding", 1500)); // 弱守军
    draft.wars.push(relationPairKey("roc", "warlords")); // 保定 1936 属军阀口径，占领需对省主交战
    const res = applyAction(draft, {
      type: "ATTACK", factionId: "roc", divisionIds: ["b-a1", "b-a2"], supportDivisionIds: ["b-s1"],
      targetProvinceId: "baoding",
    });
    expect(res.error).toBeNull();
    expect(res.state.provinces["baoding"]!.ownerId).toBe("roc");
    const sup = res.state.divisions.find((d) => d.id === "b-s1")!;
    expect(sup.provinceId).toBe("beiping"); // 没离开本省
    expect(sup.movedTurn).toBe(res.state.turn); // 参战消耗行动
    expect(sup.org).toBeLessThan(100); // 付了支援组织度
    // 三期追击：装甲师决胜大胜后乘胜追击占领无守军的大同（不再停在保定）
    for (const id of ["b-a1", "b-a2"]) {
      expect(res.state.divisions.find((d) => d.id === id)!.provinceId).toBe("datong");
    }
    expect(res.state.provinces["datong"]!.ownerId).toBe("roc");
    const log = res.state.log.filter((l) => l.kind === "battle").at(-1)!;
    expect(log.text).toContain("支援");
    expect(log.text).toContain("追击");
  });
});

describe("前线与预备队", () => {
  it("前线被歼后预备队递补接战（预备队组织度被消耗）", () => {
    const draft = baseWar();
    // 主攻来源（石家庄）放 3 个残兵师占前线；大同放 2 个满编师作预备（来源序在后）
    for (let i = 0; i < 3; i += 1) draft.divisions.push(mkDiv(`b-f${i}`, "roc", "armor", "shijiazhuang", 450));
    draft.divisions.push(mkDiv("b-r1", "roc", "armor", "datong"));
    draft.divisions.push(mkDiv("b-r2", "roc", "armor", "datong"));
    for (let i = 0; i < 3; i += 1) draft.divisions.push(mkDiv(`b-e${i}`, "japan", "kwantung", "taiyuan"));
    const est = estimateAttack(draft, "roc", ["b-f0", "b-f1", "b-f2", "b-r1", "b-r2"], "taiyuan")!;
    expect(est.atkFrontline).toBe(3);
    expect(est.atkReserves).toBe(2);
    const res = applyAction(draft, {
      type: "ATTACK", factionId: "roc",
      divisionIds: ["b-f0", "b-f1", "b-f2", "b-r1", "b-r2"],
      targetProvinceId: "taiyuan",
    });
    expect(res.error).toBeNull();
    // 残兵前线已被歼
    expect(res.state.divisions.some((d) => d.id === "b-f0")).toBe(false);
    // 预备队递补接战：行动被消耗、组织度下降
    const r1 = res.state.divisions.find((d) => d.id === "b-r1");
    expect(r1).toBeDefined();
    expect(r1!.movedTurn).toBe(res.state.turn);
    expect(r1!.org).toBeLessThan(100);
  });
});

describe("组织度", () => {
  it("进攻消耗组织度；组织度 <20 不得进攻；低组织度预估战力更低", () => {
    const draft = baseWar();
    draft.divisions.push(mkDiv("b-o1", "roc", "armor", "shijiazhuang"));
    draft.divisions.push(mkDiv("b-d1", "japan", "infantry_jp", "baoding", 1500));
    const estFull = estimateAttack(draft, "roc", ["b-o1"], "baoding")!;
    const low = clone(draft);
    low.divisions.find((d) => d.id === "b-o1")!.org = 20;
    const estLow = estimateAttack(low, "roc", ["b-o1"], "baoding")!;
    expect(estLow.ratio).toBeLessThan(estFull.ratio);
    const res = applyAction(draft, {
      type: "ATTACK", factionId: "roc", divisionIds: ["b-o1"], targetProvinceId: "baoding",
    });
    expect(res.error).toBeNull();
    const after = res.state.divisions.find((d) => d.id === "b-o1");
    if (after) expect(after.org).toBeLessThanOrEqual(94); // 至少一个阶段 -6
    const blocked = clone(draft);
    blocked.divisions.find((d) => d.id === "b-o1")!.org = 10;
    const res2 = applyAction(blocked, {
      type: "ATTACK", factionId: "roc", divisionIds: ["b-o1"], targetProvinceId: "baoding",
    });
    expect(res2.error).toBe("ORG_TOO_LOW");
  });

  it("行军耗组织度（每省 -3）；驻扎恢复：有补给快、断补给慢", () => {
    const draft = baseWar();
    draft.divisions.push(mkDiv("b-m1", "roc", "infantry", "zhengzhou"));
    const moved = applyAction(draft, {
      type: "MOVE_UNITS", factionId: "roc", divisionIds: ["b-m1"], toProvinceId: "kaifeng",
    });
    expect(moved.error).toBeNull();
    expect(moved.state.divisions.find((d) => d.id === "b-m1")!.org).toBe(97);

    const rec = baseWar();
    rec.divisions.push(mkDiv("b-g1", "roc", "infantry", "zhengzhou")); // 有补给（己方连通）
    rec.divisions.push(mkDiv("b-g2", "roc", "infantry", "sapporo")); // 孤悬敌后，断补给
    rec.divisions.find((d) => d.id === "b-g1")!.org = 40;
    rec.divisions.find((d) => d.id === "b-g2")!.org = 40;
    for (const d of rec.divisions) d.movedTurn = -1;
    rec.turn = 5;
    settleAllFactions(rec);
    const g1 = rec.divisions.find((d) => d.id === "b-g1")!.org;
    const g2 = rec.divisions.find((d) => d.id === "b-g2")!.org;
    expect(g1).toBeGreaterThan(60); // 40 + 25*地形恢复乘子
    expect(g2).toBeGreaterThan(40);
    expect(g2).toBeLessThan(g1); // 断补给恢复显著更慢
  });
});

describe("多方向合击与战报", () => {
  it("两方向合击只结一场，战报含阶段与修正明细（含包抄）", () => {
    const draft = baseWar();
    draft.divisions.push(mkDiv("b-h1", "roc", "armor", "shijiazhuang"));
    draft.divisions.push(mkDiv("b-h2", "roc", "armor", "beiping"));
    draft.divisions.push(mkDiv("b-d1", "japan", "infantry_jp", "baoding"));
    const before = draft.log.filter((l) => l.kind === "battle").length;
    const res = applyAction(draft, {
      type: "ATTACK", factionId: "roc", divisionIds: ["b-h1", "b-h2"], targetProvinceId: "baoding",
    });
    expect(res.error).toBeNull();
    const battles = res.state.log.filter((l) => l.kind === "battle");
    expect(battles.length).toBe(before + 1);
    const text = battles.at(-1)!.text;
    expect(text).toContain("接敌");
    expect(text).toContain("修正：");
    expect(text).toContain("包抄 2 个方向");
  });
});

describe("v3 存档迁移", () => {
  it("v3（无 org）存档加载后补 org=100 并升现行版本", () => {
    const s = createInitialState({ seed: 5, playerFactionId: "roc" });
    const parsed = JSON.parse(serializeSave(s)) as Record<string, unknown>;
    const st = (parsed as unknown as { state: { version: number; divisions: Array<Record<string, unknown>> } }).state;
    st.version = 3;
    for (const d of st.divisions) delete d.org;
    const loaded = deserializeSave(JSON.stringify(parsed));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state.version).toBe(7);
      expect(loaded.state.divisions.every((d) => d.org === 100)).toBe(true);
    }
  });
});
