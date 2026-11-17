// 引擎测试：rng / guards / 存档 / llm 回退（玩法逻辑见 logic.test.ts，对打见 sim.test.ts）。

import { describe, it, expect } from "vitest";
import { createRng, hashSeed, restoreRng } from "../src/core/rng";
import { clamp, clampInt, clampPercent, clampNonNegative, clampHeadcount } from "../src/core/guards";
import { createInitialState } from "../src/state/createInitialState";
import { applyAction } from "../src/core/applyAction";
import {
  SaveManager,
  createMemoryStorage,
  serializeSave,
  deserializeSave,
  importSaveJson,
  SAVE_FORMAT_VERSION,
} from "../src/save/saveGame";
import {
  loadLlmSettings,
  saveLlmSettings,
  clearLlmSettings,
  DEFAULT_LLM_SETTINGS,
} from "../src/llm/llmSettings";
import {
  isLlmAvailable,
  getDiplomacyDialogEntry,
  requestDiplomacyReply,
  type LlmTransport,
} from "../src/llm/llmClient";

describe("rng", () => {
  it("同种子同序列、不同种子不同序列、字符串种子稳定", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    const c = createRng(43);
    expect(c.next()).not.toBe(createRng(42).next());
    expect(hashSeed("asia")).toBe(hashSeed("asia"));
    expect(hashSeed("asia")).not.toBe(hashSeed("front"));
  });

  it("子流同标签同序列且不干扰主流；状态可恢复续跑", () => {
    const main = createRng(7);
    const sub1 = main.derive("combat");
    const seq = [sub1.next(), sub1.next()];
    const sub2 = createRng(7).derive("combat");
    expect([sub2.next(), sub2.next()]).toEqual(seq);
    const r = createRng(99);
    r.next();
    const restored = restoreRng(r.getState());
    expect(restored.next()).toBe(r.next());
    const ints = createRng(5);
    for (let i = 0; i < 50; i += 1) {
      const v = ints.nextInt(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});

describe("guards", () => {
  it("边界钳制", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clampInt(2.7, 0, 10)).toBe(2);
    expect(clampPercent(120)).toBe(100);
    expect(clampPercent(-4)).toBe(0);
    expect(clampNonNegative(-1)).toBe(0);
    expect(clampHeadcount(123.9)).toBe(123);
    expect(clamp(Number.NaN, 0, 10)).toBe(0);
  });
});

describe("初始状态与时钟", () => {
  it("开局 1936 年 1 月、回合 1、玩家势力可任选（参数化、无硬编码）", () => {
    const s = createInitialState({ seed: 1 });
    expect(s.year).toBe(1936);
    expect(s.month).toBe(1);
    expect(s.turn).toBe(1);
    expect(s.playerFactionId).toBe("roc"); // 默认值 = 国民政府（默认高亮，非锁定）
    const chosen = createInitialState({ seed: 1, playerFactionId: "japan" });
    expect(chosen.playerFactionId).toBe("japan");
  });

  it("玩家可换国家（用户 02:05 亲定）：18 家逐个建局成功且可推进回合", () => {
    const ids = [
      "roc", "ccp", "warlords", "japan", "manchukuo", "wangjingwei", "mengjiang",
      "thailand", "usa", "uk", "netherlands", "france", "ussr", "mongolia",
      "vietminh", "bna", "ina", "philippines",
    ];
    for (const fid of ids) {
      const s = createInitialState({ seed: 11, playerFactionId: fid });
      expect(s.playerFactionId).toBe(fid);
      expect(s.factions[fid]!.active).toBe(true); // 含事件生成势力：玩家选了即提前激活
      const res = applyAction(s, { type: "END_TURN" });
      expect(res.error).toBeNull();
      expect(res.state.turn).toBe(2);
      expect(res.state.playerFactionId).toBe(fid);
    }
  });

  it("END_TURN 按月推进、跨年正确", () => {
    let s = createInitialState({ seed: 3 });
    for (let i = 0; i < 12; i += 1) {
      const res = applyAction(s, { type: "END_TURN" });
      expect(res.error).toBeNull();
      s = res.state;
    }
    expect(s.turn).toBe(13);
    expect(s.year).toBe(1937);
    expect(s.month).toBe(1);
  });

  it("NOOP 原样返回；非法动作返回原状态 + 错误、不抛异常", () => {
    const s = createInitialState();
    const noop = applyAction(s, { type: "NOOP" });
    expect(noop.error).toBeNull();
    expect(noop.state).toBe(s);
    for (const bad of [null, 42, "END_TURN", {}, { type: "FLY" }, { type: 7 }]) {
      const res = applyAction(s, bad);
      expect(res.error).toContain("UNKNOWN_ACTION");
      expect(res.state).toBe(s);
    }
  });
});

describe("存档", () => {
  it("往返一致；空槽/坏 JSON/版本篡改/缺种子一律拒绝", () => {
    const storage = createMemoryStorage();
    const mgr = new SaveManager(storage);
    expect(mgr.load("manual-1").ok).toBe(false);
    const s = createInitialState({ seed: 2026, playerFactionId: "roc" });
    mgr.save("manual-1", s, "2026-01-01T00:00:00.000Z");
    const loaded = mgr.load("manual-1");
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state).toEqual(s);
    }
    expect(deserializeSave("not json").ok).toBe(false);
    const tampered = JSON.parse(serializeSave(s)) as { formatVersion: number };
    tampered.formatVersion = SAVE_FORMAT_VERSION + 99;
    expect(deserializeSave(JSON.stringify(tampered)).ok).toBe(false);
    const noSeed = JSON.parse(serializeSave(s)) as Record<string, unknown>;
    delete noSeed.seed;
    expect(deserializeSave(JSON.stringify(noSeed)).ok).toBe(false);
  });

  it("宽容导入：信封直通、裸 state 包信封后过校验、坏数据拒绝", () => {
    const s = createInitialState({ seed: 777, playerFactionId: "japan" });
    const envelope = serializeSave(s);
    const viaEnvelope = importSaveJson(envelope);
    expect(viaEnvelope.ok).toBe(true);
    if (viaEnvelope.ok) expect(viaEnvelope.state.seed).toBe(777);
    const bare = JSON.stringify(s);
    const viaBare = importSaveJson(bare);
    expect(viaBare.ok).toBe(true);
    if (viaBare.ok) {
      expect(viaBare.state.seed).toBe(777);
      expect(viaBare.state.playerFactionId).toBe("japan");
    }
    expect(importSaveJson("not json").ok).toBe(false);
    expect(importSaveJson(JSON.stringify({ hello: "world" })).ok).toBe(false);
    expect(importSaveJson(JSON.stringify({ provinces: {}, turn: "x" })).ok).toBe(false);
  });
});

describe("llm 接口骨架（没接 AI = 完整正常游戏）", () => {
  it("设置存取与清空；无 Key 时不可用且对话请求直接回退、绝不抛异常", async () => {
    const storage = createMemoryStorage();
    expect(loadLlmSettings(storage)).toEqual(DEFAULT_LLM_SETTINGS);
    const configured = { baseUrl: "https://example.invalid/v1", apiKey: "sk-x", model: "m1" };
    saveLlmSettings(storage, configured);
    expect(loadLlmSettings(storage)).toEqual(configured);
    expect(isLlmAvailable(configured)).toBe(true);
    clearLlmSettings(storage);
    expect(isLlmAvailable(loadLlmSettings(storage))).toBe(false);

    const entry = getDiplomacyDialogEntry(DEFAULT_LLM_SETTINGS);
    expect(entry).toEqual({ enabled: false, label: "未接入 AI 对话（可在设置中接入）" });

    let called = false;
    const transport: LlmTransport = async () => {
      called = true;
      return "x";
    };
    const r = await requestDiplomacyReply(DEFAULT_LLM_SETTINGS, [], transport);
    expect(r.kind).toBe("fallback");
    expect(called).toBe(false);
  });

  it("transport 成功走 llm、抛错/超时回退", async () => {
    const configured = { baseUrl: "https://example.invalid/v1", apiKey: "sk-x", model: "m1" };
    const okT: LlmTransport = async () => "reply";
    expect(await requestDiplomacyReply(configured, [], okT)).toEqual({ kind: "llm", text: "reply" });
    const badT: LlmTransport = async () => {
      throw new Error("down");
    };
    const r = await requestDiplomacyReply(configured, [], badT);
    expect(r.kind).toBe("fallback");
    const slowT: LlmTransport = () =>
      new Promise((resolve) => setTimeout(() => resolve("late"), 200));
    const r2 = await requestDiplomacyReply(configured, [], slowT, { timeoutMs: 20 });
    expect(r2.kind).toBe("fallback");
  });
});
