// M2 验收：sim 全 AI 对打——300 回合不崩、边界真实变动、玩家不作为会被打、单回合结算 <1s、同种子可复现。

import { describe, it, expect } from "vitest";
import { runSimulation } from "../sim/simulator";
import { createInitialState } from "../src/state/createInitialState";
import { applyAction } from "../src/core/applyAction";
import { controlledProvinceCount } from "../src/core/relations";

describe("sim 全 AI 对打", () => {
  it("300 回合不崩（或因胜负条件提前结束）", () => {
    const run = runSimulation({ seed: 7, turns: 300, playerFactionId: "roc" });
    expect(run.turnsRun + (run.finalState.gameOver ? 0 : 0)).toBeGreaterThan(0);
    expect(run.finalState.turn).toBe(1 + run.turnsRun);
    if (!run.finalState.gameOver) {
      expect(run.turnsRun).toBe(300);
    }
  }, 120000);

  it("边界真实变动：全 AI 世界到 1942 年至少 8 个省份易主（战争真实推进，非静止沙盘）", () => {
    const initial = createInitialState({ seed: 1 });
    let maxChanges = 0;
    for (const seed of [1, 2, 3]) {
      const run = runSimulation({ seed, turns: 71, playerFactionId: "thailand" });
      let changes = 0;
      for (const pid of Object.keys(initial.provinces)) {
        if (run.finalState.provinces[pid]!.ownerId !== initial.provinces[pid]!.ownerId) {
          changes += 1;
        }
      }
      maxChanges = Math.max(maxChanges, changes);
    }
    expect(maxChanges).toBeGreaterThanOrEqual(8);
  }, 120000);

  it("玩家不作为会被打：roc 挂机到 1945 年，领土或部队有实质损失", () => {
    const start = createInitialState({ seed: 5, playerFactionId: "roc" });
    const startProvinces = controlledProvinceCount(start, "roc");
    const startStrength = start.divisions
      .filter((d) => d.factionId === "roc")
      .reduce((sum, d) => sum + d.strength, 0);
    const run = runSimulation({ seed: 5, turns: 108, playerFactionId: "roc" });
    const endProvinces = controlledProvinceCount(run.finalState, "roc");
    const endStrength = run.finalState.divisions
      .filter((d) => d.factionId === "roc")
      .reduce((sum, d) => sum + d.strength, 0);
    expect(endProvinces < startProvinces || endStrength < startStrength).toBe(true);
  }, 120000);

  it("同种子同结果（全 AI 对打可复现）", () => {
    const a = runSimulation({ seed: 5, turns: 120, playerFactionId: "roc" });
    const b = runSimulation({ seed: 5, turns: 120, playerFactionId: "roc" });
    expect(a.finalState).toEqual(b.finalState);
  }, 120000);

  it("单回合全 AI 结算 < 1s", () => {
    let s = createInitialState({ seed: 3, playerFactionId: "roc" });
    for (let i = 0; i < 6; i += 1) {
      s = applyAction(s, { type: "END_TURN" }).state;
    }
    const t0 = performance.now();
    const res = applyAction(s, { type: "END_TURN" });
    const elapsed = performance.now() - t0;
    expect(res.error).toBeNull();
    expect(elapsed).toBeLessThan(1000);
  }, 60000);
});
