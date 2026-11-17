// 地形系统验收（T1）：八类地形与特征标记、战斗地形差、移动成本差、断补给衰减差、容量递减、筑垒成长。
import { describe, it, expect } from "vitest";
import { createInitialState } from "../src/state/createInitialState";
import { settleAllFactions } from "../src/core/settlement";
import { estimateAttack } from "../src/core/combat";
import { reachableWithin } from "../src/core/movement";
import { neighborsOf } from "../src/core/mapGraph";
import { relationPairKey } from "../src/data/diplomacy";
import { PROVINCES, PROVINCE_MAP } from "../src/data/provinces";
import { TERRAIN_PARAMS } from "../src/data/terrain";
import { TEMPLATES } from "../src/data/units";
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

describe("地形数据", () => {
  it("八类地形齐备且每省地形合法；特征标记保全（港口 64）", () => {
    expect(Object.keys(TERRAIN_PARAMS).sort()).toEqual(
      ["desert", "forest", "hills", "jungle", "marsh", "mountain", "plains", "urban"],
    );
    for (const p of PROVINCES) expect(TERRAIN_PARAMS[p.terrain]).toBeDefined();
    expect(PROVINCES.filter((p) => p.isPort).length).toBe(69); // 64 + 海航线端点补标 5（首尔/海南/土格加劳/萨哈林/关岛）
    expect(PROVINCE_MAP["shanghai"]!.isPort).toBe(true);
    expect(PROVINCE_MAP["shanghai"]!.terrain).toBe("urban");
    expect(PROVINCE_MAP["hainan"]!.isIsland).toBe(true);
    expect(PROVINCE_MAP["hainan"]!.terrain).toBe("jungle");
    expect(PROVINCE_MAP["sakhalin"]!.terrain).toBe("forest");
    expect(PROVINCE_MAP["rangoon"]!.terrain).toBe("marsh");
    for (const t of Object.values(TERRAIN_PARAMS)) {
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(t.capacity).toBeGreaterThan(0);
    }
  });
});

describe("战斗地形差", () => {
  function setup(defTarget: string) {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const draft = clone(s);
    draft.wars.push(relationPairKey("japan", "roc"));
    draft.divisions = draft.divisions.filter(
      (d) => d.provinceId !== "shijiazhuang" && d.provinceId !== defTarget,
    );
    draft.divisions.push(mkDiv("t-atk", "roc", "armor", "shijiazhuang"));
    draft.divisions.push(mkDiv("t-def", "japan", "infantry_jp", defTarget));
    return draft;
  }

  it("同装甲师打平原 vs 山地：山地战力比显著更低（地形攻惩+守方防御）", () => {
    const plains = estimateAttack(setup("baoding"), "roc", ["t-atk"], "baoding")!;
    const mountain = estimateAttack(setup("taiyuan"), "roc", ["t-atk"], "taiyuan")!;
    expect(plains.terrain).toBe("plains");
    expect(mountain.terrain).toBe("mountain");
    expect(mountain.ratio).toBeLessThan(plains.ratio * 0.6);
    expect(mountain.defTerrainMult).toBeCloseTo(TERRAIN_PARAMS.mountain.defMult);
  });

  it("前线容量：6 师攻山地（容量 3）前线 3 师＋预备 3 师，预估战力与 3 师同", () => {
    const s = createInitialState({ seed: 3, playerFactionId: "thailand" });
    const draft = clone(s);
    draft.wars.push(relationPairKey("japan", "roc"));
    draft.divisions = draft.divisions.filter((d) => d.provinceId !== "shijiazhuang" && d.provinceId !== "taiyuan");
    draft.divisions.push(mkDiv("t-def", "japan", "infantry_jp", "taiyuan"));
    for (let i = 0; i < 6; i += 1) draft.divisions.push(mkDiv(`t-a${i}`, "roc", "armor", "shijiazhuang"));
    const est6 = estimateAttack(draft, "roc", draft.divisions.filter((d) => d.provinceId === "shijiazhuang").map((d) => d.id), "taiyuan")!;
    expect(est6.capacity).toBe(3);
    expect(est6.atkFrontline).toBe(3);
    expect(est6.atkReserves).toBe(3);
    draft.divisions = draft.divisions.filter((d) => !["t-a3", "t-a4", "t-a5"].includes(d.id));
    const est3 = estimateAttack(draft, "roc", draft.divisions.filter((d) => d.provinceId === "shijiazhuang").map((d) => d.id), "taiyuan")!;
    expect(est3.atkFrontline).toBe(3);
    expect(est3.atkReserves).toBe(0);
    expect(est6.atkPower).toBeCloseTo(est3.atkPower, 5);
  });
});

describe("行军成本差", () => {
  it("太原->临汾（山地）：山地师可达、步兵不可达（成本 3.85 vs 7，预算 4）", () => {
    expect(neighborsOf("taiyuan")).toContain("linfen");
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const mtn = mkDiv("t-m", "roc", "mountain", "taiyuan");
    const inf = mkDiv("t-i", "roc", "infantry", "taiyuan");
    expect(reachableWithin(s, mtn).has("linfen")).toBe(true);
    expect(reachableWithin(s, inf).has("linfen")).toBe(false);
  });

  it("平原纵深：步兵郑州->蚌埠（成本 4）可达、徐州/淮南不可达；装甲可达淮南", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const inf = mkDiv("t-i2", "roc", "infantry", "zhengzhou");
    const arm = mkDiv("t-a9", "roc", "armor", "zhengzhou");
    const reachInf = reachableWithin(s, inf);
    const reachArm = reachableWithin(s, arm);
    expect(reachInf.get("bengbu")).toBe(4); // 郑州->开封->蚌埠，平原 2+2
    expect(reachInf.get("luoyang")).toBe(4); // 平原 2 + 渡河 2（行军渡河成本与战斗惩罚分开）
    expect(reachInf.has("xuzhou")).toBe(false);
    expect(reachInf.has("huainan")).toBe(false); // 沼泽进省 5 点，路径总成本超预算
    expect(reachArm.has("huainan")).toBe(true);
    expect(reachArm.size).toBeGreaterThan(reachInf.size);
  });
});

describe("补给损耗与筑垒（地形驱动）", () => {
  it("断补给衰减：山地（×1.6）比平原（×1.0）掉得更多", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const draft = clone(s);
    draft.factions["japan"]!.stockpile.food = 999999;
    const dM = mkDiv("t-dm", "japan", "infantry_jp", "lhasa"); // 山地、无补给
    const dP = mkDiv("t-dp", "japan", "infantry_jp", "duolun"); // 平原、无补给
    draft.divisions.push(dM, dP);
    settleAllFactions(draft);
    const full = TEMPLATES["infantry_jp"]!.fullStrength;
    const afterM = draft.divisions.find((d) => d.id === "t-dm")!.strength;
    const afterP = draft.divisions.find((d) => d.id === "t-dp")!.strength;
    expect(afterM).toBe(Math.floor(full * (1 - 0.05 * 1.6)));
    expect(afterP).toBe(Math.floor(full * (1 - 0.05 * 1.0)));
    expect(afterM).toBeLessThan(afterP);
  });

  it("筑垒成长按地形：山地省驻军 staticMonths 增速（1.5）高于平原（0.6）", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const draft = clone(s);
    const mDiv = draft.divisions.find((d) => d.provinceId === "taiyuan")!;
    const pDiv = draft.divisions.find((d) => d.provinceId === "zhengzhou")!;
    expect(mDiv).toBeDefined();
    expect(pDiv).toBeDefined();
    settleAllFactions(draft);
    expect(draft.divisions.find((d) => d.id === mDiv.id)!.staticMonths).toBeCloseTo(1.5);
    expect(draft.divisions.find((d) => d.id === pDiv.id)!.staticMonths).toBeCloseTo(0.6);
  });
});
