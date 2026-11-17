// 音频挂钩判定（纯函数 planSounds）与设置持久化测试：只读判定、不碰引擎结算。
import { describe, it, expect } from "vitest";
import { createInitialState } from "../src/state/createInitialState";
import { applyAction, type GameAction } from "../src/core/applyAction";
import { planSounds, loadSettings, saveSettings, DEFAULT_SETTINGS } from "../src/ui/audio";
import { relationPairKey } from "../src/core/relations";
import type { GameState } from "../src/state/types";

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState;
const slots = (pre: GameState, action: Parameters<typeof planSounds>[1], post: GameState, error: string | null): string[] =>
  planSounds(pre, action, post, error).map((c) => c.slot);

function arena(): GameState {
  const s = createInitialState({ seed: 5, playerFactionId: "roc" });
  const draft = clone(s);
  draft.wars.push(relationPairKey("japan", "roc"));
  draft.wars.push(relationPairKey("roc", "warlords")); // 保定属军阀：占领须对省主交战
  for (const pid of ["shijiazhuang", "baoding"]) {
    draft.divisions = draft.divisions.filter((d) => d.provinceId !== pid);
  }
  return draft;
}
function mkDiv(id: string, factionId: string, templateId: string, provinceId: string, strength = 10000) {
  return {
    id, factionId, templateId, provinceId, strength,
    movedTurn: -1, staticMonths: 0, org: 100,
  } as GameState["divisions"][number];
}

describe("planSounds 挂钩判定", () => {
  it("失败一律驳回音", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    expect(slots(s, { type: "MOVE_UNITS", factionId: "roc", divisionIds: ["x"], toProvinceId: "wuhan" }, s, "UNKNOWN_DIVISION"))
      .toEqual(["order_cancel"]);
  });

  it("行军=order_march、驻扎=order_garrison", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const div = s.divisions.find((d) => d.factionId === "roc")!;
    const mv = applyAction(s, { type: "MOVE_UNITS", factionId: "roc", divisionIds: [div.id], toProvinceId: div.provinceId });
    expect(slots(s, { type: "MOVE_UNITS", factionId: "roc", divisionIds: [div.id], toProvinceId: div.provinceId }, mv.state, mv.error))
      .toContain("order_march");
    expect(slots(s, { type: "HOLD_POSITION", factionId: "roc", divisionIds: [div.id] }, s, null))
      .toEqual(["order_garrison"]);
  });

  it("进攻攻克：order_attack + battle_start + province_captured + battle_victory", () => {
    const draft = arena();
    draft.divisions.push(mkDiv("a-1", "roc", "infantry", "shijiazhuang"));
    draft.divisions.push(mkDiv("a-2", "roc", "infantry", "shijiazhuang"));
    draft.divisions.push(mkDiv("d-1", "japan", "infantry_jp", "baoding", 1200));
    const action: GameAction = { type: "ATTACK", factionId: "roc", divisionIds: ["a-1", "a-2"], targetProvinceId: "baoding" };
    const r = applyAction(draft, action);
    expect(r.error).toBeNull();
    const got = slots(draft, action, r.state, null);
    expect(got).toContain("order_attack");
    expect(got).toContain("battle_start");
    expect(got).toContain("province_captured");
    expect(got).toContain("battle_victory");
  });

  it("进攻未克：battle_defeat 且无攻克音", () => {
    const draft = arena();
    draft.divisions.push(mkDiv("a-1", "roc", "infantry", "shijiazhuang", 2000));
    draft.divisions.push(mkDiv("d-1", "japan", "infantry_jp", "baoding", 10000));
    draft.divisions.push(mkDiv("d-2", "japan", "infantry_jp", "baoding", 10000));
    const action: GameAction = { type: "ATTACK", factionId: "roc", divisionIds: ["a-1"], targetProvinceId: "baoding" };
    const r = applyAction(draft, action);
    expect(r.error).toBeNull();
    const got = slots(draft, action, r.state, null);
    expect(got).toContain("battle_defeat");
    expect(got).not.toContain("province_captured");
  });

  it("宣战=declare_war、媾和=peace", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const war: GameAction = { type: "DIPLOMACY", factionId: "roc", targetId: "warlords", actionId: "declareWar" };
    const r = applyAction(s, war);
    expect(r.error).toBeNull();
    expect(slots(s, war, r.state, null)).toEqual(["declare_war"]);
    expect(slots(s, { type: "DIPLOMACY", factionId: "roc", targetId: "ccp", actionId: "peace" }, s, null))
      .toEqual(["peace"]);
  });

  it("END_TURN 触发历史事件：含 event_telegraph", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const draft = clone(s);
    draft.turn = 10;
    draft.month = 11; // END_TURN 推进到 1936-12，西安事变到期（事件按 year/month 匹配；条件不合也会记「未发生」事件条）
    const r = applyAction(draft, { type: "END_TURN" });
    expect(r.error).toBeNull();
    const newEvents = r.state.log.slice(draft.log.length).filter((l) => l.kind === "event");
    expect(newEvents.length).toBeGreaterThan(0);
    const got = slots(draft, { type: "END_TURN" }, r.state, null);
    expect(got[0]).toBe("order_march");
    expect(got).toContain("event_telegraph");
  });

  it("END_TURN 胜负落定：music_victory / music_defeat", () => {
    const s = createInitialState({ seed: 1, playerFactionId: "roc" });
    const post = clone(s);
    post.gameOver = { winnerId: "roc", reason: "测试" };
    expect(slots(s, { type: "END_TURN" }, post, null)).toContain("music_victory");
    const post2 = clone(s);
    post2.gameOver = { winnerId: "japan", reason: "测试" };
    expect(slots(s, { type: "END_TURN" }, post2, null)).toContain("music_defeat");
  });
});

describe("音频设置持久化", () => {
  function fakeStorage(initial: Record<string, string> = {}) {
    const m = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => { m.set(k, v); },
      dump: () => Object.fromEntries(m),
    };
  }
  it("无存档回默认；存后能读回；坏数据回默认；越界钳制", () => {
    const st = fakeStorage();
    expect(loadSettings(st)).toEqual(DEFAULT_SETTINGS);
    saveSettings({ musicVol: 0.3, sfxVol: 0.4, muted: true, ambience: true }, st);
    expect(loadSettings(st)).toEqual({ musicVol: 0.3, sfxVol: 0.4, muted: true, ambience: true });
    const bad = fakeStorage({ "asia-front-audio": "{oops" });
    expect(loadSettings(bad)).toEqual(DEFAULT_SETTINGS);
    const over = fakeStorage({ "asia-front-audio": JSON.stringify({ musicVol: 7, sfxVol: -2 }) });
    const got = loadSettings(over);
    expect(got.musicVol).toBe(1);
    expect(got.sfxVol).toBe(0);
  });
});
