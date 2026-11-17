// M1 数据包断言：18 家齐/首都与开局落子有效/难度标签齐（统一胜利口径，无专属胜利目标字段）/
// 省份数量与图连通/seaLinks 对称/模板与特色师/事件与国策结构完整。

import { describe, it, expect } from "vitest";
import { FACTIONS, FACTION_IDS } from "../src/data/factions";
import { PROVINCES, PROVINCE_MAP, RIVER_CROSSINGS, RIVER_ATK_MULT, isRiverCrossing } from "../src/data/provinces";
import { STATES, STATE_MAP } from "../src/data/states";
import { TEMPLATES } from "../src/data/units";
import { EVENTS } from "../src/data/events";
import { FOCUSES } from "../src/data/focuses";
import { neighborsOf, areAdjacent, isSeaEdge } from "../src/core/mapGraph";
import {
  BASE_ATTACK, PLAN, FORTIFY, ENCIRCLEMENT, INFILTRATION, AIR, LANDING, SPEARHEAD, RAID,
} from "../src/data/combatSystems";

describe("势力数据", () => {
  it("18 家齐全，id 与夜班令一致", () => {
    expect(FACTION_IDS).toHaveLength(18);
    expect(FACTION_IDS).toEqual(
      expect.arrayContaining([
        "roc", "ccp", "warlords", "japan", "manchukuo", "wangjingwei", "mengjiang",
        "thailand", "usa", "uk", "netherlands", "france", "ussr", "mongolia",
        "vietminh", "bna", "ina", "philippines",
      ]),
    );
  });

  it("每家：首都存在、人设卡与性格四维齐全、难度标签齐（统一胜利，无 victoryGoals 字段）", () => {
    for (const fid of FACTION_IDS) {
      const f = FACTIONS[fid];
      expect(PROVINCE_MAP[f.capitalProvinceId], `${fid} 首都`).toBeDefined();
      expect(f.leader.name.length).toBeGreaterThan(0);
      expect(f.leader.personality.length).toBeGreaterThan(0);
      expect(f.leader.speakingStyle.length).toBeGreaterThan(0);
      expect(f.leader.redLine.length).toBeGreaterThan(0);
      for (const k of ["aggression", "expansion", "industry", "caution"] as const) {
        expect(f.aiPersonality[k]).toBeGreaterThanOrEqual(0);
        expect(f.aiPersonality[k]).toBeLessThanOrEqual(1);
      }
      expect(["simple", "normal", "hard", "hell"]).toContain(f.difficulty.level);
      expect(f.difficulty.reason.length).toBeGreaterThan(4);
      expect(f as unknown as Record<string, unknown>).not.toHaveProperty("victoryGoals");
      expect(/^#[0-9a-f]{6}$/i.test(f.colorHex)).toBe(true);
    }
  });

  it("每家开局落子有效：初始师/支援单位引用的模板与省份都存在", () => {
    for (const fid of FACTION_IDS) {
      const f = FACTIONS[fid];
      for (const d of f.initialDivisions) {
        expect(TEMPLATES[d.templateId], `${fid} 模板 ${d.templateId}`).toBeDefined();
        expect(PROVINCE_MAP[d.provinceId], `${fid} 落子省 ${d.provinceId}`).toBeDefined();
      }
      for (const s of f.initialSupports) {
        expect(PROVINCE_MAP[s.provinceId]).toBeDefined();
      }
    }
  });

  it("事件生成势力口径（用户 02:09 定版）：wangjingwei 1940 / mengjiang 1939 / vietminh / bna / ina 均 dormant", () => {
    for (const fid of ["wangjingwei", "mengjiang", "vietminh", "bna", "ina"] as const) {
      expect(FACTIONS[fid].startsActive).toBe(false);
      expect(FACTIONS[fid].spawn).not.toBeNull();
    }
    expect(FACTIONS.wangjingwei.spawn).toMatchObject({ year: 1940, month: 3 });
    expect(FACTIONS.mengjiang.spawn).toMatchObject({ year: 1939, month: 9 });
    expect(FACTIONS.vietminh.spawn).toMatchObject({ year: 1941, month: 5 });
    // 1936 年蒙疆本部属地方军阀（史实格局）
    for (const pid of ["hohhot", "baotou", "zhangjiakou", "duolun"]) {
      expect(PROVINCE_MAP[pid]!.ownerId).toBe("warlords");
    }
  });

  it("每家有 flagAsset 国旗（美术线已交付真实文件）与 leaderAsset 肖像字段", () => {
    for (const fid of FACTION_IDS) {
      expect(FACTIONS[fid].flagAsset).toBe(`assets/flags/${fid}.png`);
    }
    const withLeader = FACTION_IDS.filter((fid) => FACTIONS[fid].leaderAsset !== null);
    expect(withLeader.length).toBe(18); // 美术线已补齐 18/18（溥仪/昂山走真实照片路线，2026-11-16）
  });

  it("每家至少 1 个特色师（专属模板）或专属说明（特色方向非空）", () => {
    for (const fid of FACTION_IDS) {
      expect(FACTIONS[fid].specialty.length).toBeGreaterThan(4);
    }
    const specialOwners = new Set(
      Object.values(TEMPLATES).filter((t) => t.factionId !== null).map((t) => t.factionId),
    );
    for (const fid of ["roc", "ccp", "japan", "ussr", "usa", "uk"]) {
      expect(specialOwners.has(fid), `${fid} 特色师`).toBe(true);
    }
  });
});

describe("省份数据", () => {
  it("节点数量：总数 >= 78，港口/岛屿节点 >= 20", () => {
    expect(PROVINCES.length).toBeGreaterThanOrEqual(78);
    const portIsland = PROVINCES.filter((x) => x.isPort || x.isIsland);
    expect(portIsland.length).toBeGreaterThanOrEqual(20);
  });

  it("质心不重叠、id 不重复、每省有州与多边形、相邻对称", () => {
    const keys = new Set(PROVINCES.map((x) => `${x.cx},${x.cy}`));
    expect(keys.size).toBe(PROVINCES.length);
    expect(new Set(PROVINCES.map((x) => x.id)).size).toBe(PROVINCES.length);
    for (const p of PROVINCES) {
      expect(STATE_MAP[p.stateId], `${p.id} 的州`).toBeDefined();
      expect(p.path.startsWith("M")).toBe(true);
      for (const nb of [...p.neighbors, ...(p.landLinks ?? []), ...p.seaLinks]) {
        expect(neighborsOf(nb), `${p.id}->${nb} 对称`).toContain(p.id);
      }
    }
    expect(PROVINCES.length).toBe(196);
    expect(STATES.length).toBe(54);
  });

  it("渡河边均为真实相邻且 isRiverCrossing 可查", () => {
    expect(RIVER_CROSSINGS.length).toBeGreaterThanOrEqual(10);
    for (const r of RIVER_CROSSINGS) {
      expect(neighborsOf(r.a)).toContain(r.b);
      expect(isRiverCrossing(r.a, r.b)).toBe(true);
    }
    expect(isRiverCrossing("wuhan", "changsha")).toBe(true); // 长江
    expect(RIVER_ATK_MULT).toBe(0.85);
  });

  it("seaLinks 对称且目标存在；每个省份至少 1 个邻居；全图连通", () => {
    for (const prov of PROVINCES) {
      for (const target of prov.seaLinks) {
        expect(PROVINCE_MAP[target], `${prov.id} -> ${target}`).toBeDefined();
        expect(PROVINCE_MAP[target]!.seaLinks).toContain(prov.id);
        expect(isSeaEdge(prov.id, target)).toBe(true);
      }
      expect(neighborsOf(prov.id).length, `${prov.id} 邻居`).toBeGreaterThanOrEqual(1);
    }
    // 全图连通（BFS）
    const seen = new Set<string>([PROVINCES[0]!.id]);
    const queue = [PROVINCES[0]!.id];
    while (queue.length > 0) {
      const cur = queue.pop()!;
      for (const nb of neighborsOf(cur)) {
        if (!seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    expect(seen.size).toBe(PROVINCES.length);
    expect(areAdjacent("beiping", "tianjin")).toBe(true);
  });

  it("1936 归属：每家 active 势力至少 1 省（游击/事件势力除外），资源产地挂接（油/橡胶/钢各有来源省）", () => {
    const owned = new Map<string, number>();
    for (const prov of PROVINCES) {
      owned.set(prov.ownerId, (owned.get(prov.ownerId) ?? 0) + 1);
    }
    for (const fid of FACTION_IDS) {
      if (FACTIONS[fid].startsActive && fid !== "philippines") {
        expect(owned.get(fid) ?? 0, `${fid} 开局省份`).toBeGreaterThanOrEqual(1);
      }
    }
    expect(PROVINCES.some((x) => (x.oil ?? 0) > 0)).toBe(true);
    expect(PROVINCES.some((x) => (x.rubber ?? 0) > 0)).toBe(true);
    expect(PROVINCES.some((x) => (x.steel ?? 0) > 0)).toBe(true);
    expect(PROVINCE_MAP["balikpapan"]!.oil).toBeGreaterThan(0); // 婆罗洲石油（史实）
    expect(PROVINCE_MAP["kualalumpur"]!.rubber).toBeGreaterThan(0); // 马来亚橡胶（史实）
    expect(PROVINCE_MAP["shenyang"]!.steel).toBeGreaterThan(0); // 东北钢铁（史实）
  });
});

describe("事件/国策/模板结构", () => {
  it("历史事件 15-20 个、按年月升序、1936-1945 内、效果结构化非空", () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(15);
    expect(EVENTS.length).toBeLessThanOrEqual(20);
    for (let i = 0; i < EVENTS.length; i += 1) {
      const e = EVENTS[i]!;
      expect(e.year).toBeGreaterThanOrEqual(1936);
      expect(e.year).toBeLessThanOrEqual(1945);
      expect(e.effects.length).toBeGreaterThan(0);
      if (i > 0) {
        const prev = EVENTS[i - 1]!;
        expect(e.year * 12 + e.month).toBeGreaterThanOrEqual(prev.year * 12 + prev.month);
      }
    }
    const ids = EVENTS.map((e) => e.id);
    for (const key of ["xian_incident", "marco_polo", "nomonhan", "pacific_war", "soviet_entry"]) {
      expect(ids).toContain(key);
    }
  });

  it("国策：每家至少 3 个，大国（roc/japan/ussr/usa/uk）至少 5 个", () => {
    const counts = new Map<string, number>();
    for (const f of FOCUSES) {
      counts.set(f.factionId, (counts.get(f.factionId) ?? 0) + 1);
    }
    for (const fid of FACTION_IDS) {
      expect(counts.get(fid) ?? 0, `${fid} 国策数`).toBeGreaterThanOrEqual(3);
    }
    for (const fid of ["roc", "japan", "ussr", "usa", "uk"]) {
      expect(counts.get(fid) ?? 0).toBeGreaterThanOrEqual(5);
    }
  });

  it("师级模板：8 个通用模板齐全，步兵师满编约万人，兵力按实际人数", () => {
    for (const id of ["infantry", "mountain", "cavalry", "motorized", "armor", "marine", "garrison", "guerrilla"]) {
      expect(TEMPLATES[id]).toBeDefined();
    }
    expect(TEMPLATES["infantry"]!.fullStrength).toBe(10000);
    for (const t of Object.values(TEMPLATES)) {
      expect(t.fullStrength).toBeGreaterThanOrEqual(3000);
      expect(t.attack).toBeGreaterThan(0);
      expect(t.defense).toBeGreaterThan(0);
    }
  });
});

describe("战斗系统参数表（攻击玩法重做：模式拆回系统）", () => {
  it("基准/计划/筑垒/包围参数与旧定版一致（零平衡冲击）", () => {
    expect(BASE_ATTACK).toEqual({ attackMult: 1.15, attackerLossMult: 1.2, defenderLossMult: 1.1 });
    expect(PLAN).toEqual({ perLayer: 0.12, maxLayers: 3 });
    expect(FORTIFY).toEqual({ perLayer: 0.12, maxLayers: 3 });
    expect(ENCIRCLEMENT.unsuppliedDefMult).toBe(0.5);
    expect(ENCIRCLEMENT.destroyOnWin).toBe(true);
  });

  it("渗透/空优/登陆/矛头/袭扰参数齐备，渗透特性落在六个模板上", () => {
    expect(INFILTRATION.terrains).toEqual(["mountain", "jungle"]);
    expect(INFILTRATION.attackerLossMult).toBe(1.2);
    expect(INFILTRATION.minShare).toBe(0.5);
    for (const id of ["mountain", "cavalry", "guerrilla", "eighthRoute", "infantry_jp", "marine_jp"]) {
      expect(TEMPLATES[id]!.infiltration).toBe(true);
    }
    expect(TEMPLATES["infantry"]!.infiltration).toBe(false);
    expect(AIR.tierMult).toEqual({ friendly: 1.25, contested: 1.0, enemy: 0.8 });
    expect(AIR.casMult).toBe(1.15);
    expect(LANDING.attackMult).toBe(0.85);
    expect(LANDING.fleetGunsMult).toBe(1.15);
    expect(LANDING.seaTierMult).toEqual({ friendly: 1.15, contested: 1.0, enemy: 0.75 });
    expect(SPEARHEAD).toEqual({ maxCount: 2, powerMult: 1.35, lossMult: 1.5, orgCostMult: 1.5 });
    expect(RAID.successBase).toBe(0.8);
    expect(RAID.damagedMonths).toBe(2);
  });
});
