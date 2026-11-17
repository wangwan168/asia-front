// 指挥层验收：分兵出击/留守、多路合击合并一场、跨省行军续程、预估按编组、编组 CRUD、驻扎、旧存档迁移。
import { describe, it, expect } from "vitest";
import { createInitialState } from "../src/state/createInitialState";
import { applyAction } from "../src/core/applyAction";
import { estimateAttack } from "../src/core/combat";
import { relationPairKey } from "../src/data/diplomacy";
import { TEMPLATES } from "../src/data/units";
import { serializeSave, deserializeSave } from "../src/save/saveGame";
import type { GameState } from "../src/state/types";

function clone(s: GameState): GameState {
  return structuredClone(s);
}

function mkDiv(id: string, factionId: string, templateId: string, provinceId: string) {
  const tpl = TEMPLATES[templateId]!;
  return {
    id, factionId, templateId, provinceId,
    strength: tpl.fullStrength, movedTurn: -1, staticMonths: 0, org: 100,
  };
}

function warSetup() {
  const s = createInitialState({ seed: 5, playerFactionId: "roc" });
  const draft = clone(s);
  draft.wars.push(relationPairKey("japan", "roc"));
  draft.divisions = draft.divisions.filter(
    (d) => !["shijiazhuang", "beiping", "baoding"].includes(d.provinceId),
  );
  draft.divisions.push(mkDiv("c-a1", "roc", "armor", "shijiazhuang"));
  draft.divisions.push(mkDiv("c-a2", "roc", "armor", "shijiazhuang"));
  draft.divisions.push(mkDiv("c-a3", "roc", "armor", "beiping")); // 北平与保定相邻，第二路
  draft.divisions.push(mkDiv("c-d1", "japan", "infantry_jp", "baoding"));
  return draft;
}

describe("分兵出击", () => {
  it("只派一个师进攻：参战师行动/承损，留守师原地未动且仍可行动", () => {
    const s = warSetup();
    const res = applyAction(s, {
      type: "ATTACK", factionId: "roc", divisionIds: ["c-a1"], targetProvinceId: "baoding",
    });
    expect(res.error).toBeNull();
    const a1 = res.state.divisions.find((d) => d.id === "c-a1")!;
    const a2 = res.state.divisions.find((d) => d.id === "c-a2")!;
    expect(a1.movedTurn).toBe(res.state.turn);
    expect(a2.movedTurn).toBe(-1);
    expect(a2.provinceId).toBe("shijiazhuang");
    expect(a2.strength).toBe(TEMPLATES["armor"]!.fullStrength);
    // 留守师仍可独立行动
    const move = applyAction(res.state, {
      type: "MOVE_UNITS", factionId: "roc", divisionIds: ["c-a2"], toProvinceId: "zhengzhou",
    });
    expect(move.error).toBeNull();
  });

  it("预估按编组变化：2 师预估攻方战力高于 1 师", () => {
    const s = warSetup();
    const est1 = estimateAttack(s, "roc", ["c-a1"], "baoding")!;
    const est2 = estimateAttack(s, "roc", ["c-a1", "c-a2"], "baoding")!;
    expect(est1.attackerCount).toBe(1);
    expect(est2.attackerCount).toBe(2);
    expect(est2.atkPower).toBeGreaterThan(est1.atkPower);
  });
});

describe("多路合击", () => {
  it("两省三师合击同一目标：合并为一场战斗，预估/战报分列主攻助攻", () => {
    const s = warSetup();
    const est = estimateAttack(s, "roc", ["c-a1", "c-a2", "c-a3"], "baoding")!;
    expect(est.origins.length).toBe(2);
    expect(est.origins[0]).toEqual({ provinceId: "shijiazhuang", count: 2 });
    const single = estimateAttack(s, "roc", ["c-a1", "c-a2"], "baoding")!;
    expect(est.ratio).toBeGreaterThan(single.ratio);
    const logsBefore = s.log.filter((l) => l.kind === "battle").length;
    const res = applyAction(s, {
      type: "ATTACK", factionId: "roc", divisionIds: ["c-a1", "c-a2", "c-a3"],
      targetProvinceId: "baoding",
    });
    expect(res.error).toBeNull();
    const battleLogs = res.state.log.filter((l) => l.kind === "battle");
    expect(battleLogs.length).toBe(logsBefore + 1); // 只一场
    expect(battleLogs[battleLogs.length - 1]!.text).toContain("主攻");
    expect(battleLogs[battleLogs.length - 1]!.text).toContain("助攻");
    for (const id of ["c-a1", "c-a2", "c-a3"]) {
      expect(res.state.divisions.find((d) => d.id === id)!.movedTurn).toBe(res.state.turn);
    }
  });
});

describe("跨省行军续程", () => {
  it("步兵郑州->徐州（总成本 6 > 月预算 4）：当月到蚌埠存余程，END_TURN 自动续走抵达", () => {
    const s = createInitialState({ seed: 5, playerFactionId: "roc" });
    const draft = clone(s);
    draft.divisions = draft.divisions.filter((d) => d.provinceId !== "zhengzhou");
    draft.divisions.push(mkDiv("c-m1", "roc", "infantry", "zhengzhou"));
    const res = applyAction(draft, {
      type: "MOVE_UNITS", factionId: "roc", divisionIds: ["c-m1"], toProvinceId: "xuzhou",
    });
    expect(res.error).toBeNull();
    const afterOrder = res.state.divisions.find((d) => d.id === "c-m1")!;
    expect(afterOrder.provinceId).toBe("bengbu");
    expect(afterOrder.pathIds).toEqual(["xuzhou"]);
    const next = applyAction(res.state, { type: "END_TURN" });
    expect(next.error).toBeNull();
    const arrived = next.state.divisions.find((d) => d.id === "c-m1");
    expect(arrived).toBeDefined();
    expect(arrived!.provinceId).toBe("xuzhou");
    expect(arrived!.pathIds).toBeUndefined();
  });

  it("驻扎防守清行军：HOLD 后 END_TURN 不再续走", () => {
    const s = createInitialState({ seed: 5, playerFactionId: "roc" });
    const draft = clone(s);
    draft.divisions = draft.divisions.filter((d) => d.provinceId !== "zhengzhou");
    draft.divisions.push(mkDiv("c-m2", "roc", "infantry", "zhengzhou"));
    const moved = applyAction(draft, {
      type: "MOVE_UNITS", factionId: "roc", divisionIds: ["c-m2"], toProvinceId: "xuzhou",
    });
    expect(moved.error).toBeNull();
    const held = applyAction(moved.state, {
      type: "HOLD_POSITION", factionId: "roc", divisionIds: ["c-m2"],
    });
    expect(held.error).toBeNull();
    expect(held.state.divisions.find((d) => d.id === "c-m2")!.pathIds).toBeUndefined();
    const next = applyAction(held.state, { type: "END_TURN" });
    expect(next.state.divisions.find((d) => d.id === "c-m2")!.provinceId).toBe("bengbu");
  });
});

describe("常设编组", () => {
  it("建组/改成员/解散：groupId 单一事实源同步", () => {
    const s = warSetup();
    const created = applyAction(s, {
      type: "CREATE_GROUP", factionId: "roc", name: "第一军", divisionIds: ["c-a1", "c-a2"],
    });
    expect(created.error).toBeNull();
    expect(created.state.groups.length).toBe(1);
    const gid = created.state.groups[0]!.id;
    expect(created.state.divisions.find((d) => d.id === "c-a1")!.groupId).toBe(gid);
    expect(created.state.divisions.find((d) => d.id === "c-a3")!.groupId).toBeUndefined();
    const shrunk = applyAction(created.state, {
      type: "SET_GROUP_MEMBERS", factionId: "roc", groupId: gid, divisionIds: ["c-a2"],
    });
    expect(shrunk.state.divisions.find((d) => d.id === "c-a1")!.groupId).toBeNull();
    expect(shrunk.state.divisions.find((d) => d.id === "c-a2")!.groupId).toBe(gid);
    const deleted = applyAction(shrunk.state, {
      type: "DELETE_GROUP", factionId: "roc", groupId: gid,
    });
    expect(deleted.state.groups.length).toBe(0);
    expect(deleted.state.divisions.find((d) => d.id === "c-a2")!.groupId).toBeNull();
  });
});

describe("旧存档迁移", () => {
  it("v2 存档（无 groups/编组/路径字段）可加载并迁移到现行版本", () => {
    const s = createInitialState({ seed: 5, playerFactionId: "roc" });
    const old = clone(s) as unknown as Record<string, unknown>;
    old.version = 2;
    delete old.groups;
    for (const d of old.divisions as Array<Record<string, unknown>>) {
      delete d.groupId;
      delete d.pathIds;
    }
    const json = serializeSave(old as unknown as GameState);
    const loaded = deserializeSave(json);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state.version).toBe(7);
      expect(loaded.state.groups).toEqual([]);
      expect(loaded.state.divisions.every((d) => d.groupId === null)).toBe(true);
    }
  });
});
