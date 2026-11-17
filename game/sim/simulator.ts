// 模拟器（M2）：全 AI 对打——玩家势力不作为（只 END_TURN），其余势力由规则 AI 驱动。
// 无回合上限：跑多少回合由调用方决定，引擎只在胜负条件达成时停（gameOver）。

import { applyAction } from "../src/core/applyAction";
import { controlledProvinceCount } from "../src/core/relations";
import { createInitialState } from "../src/state/createInitialState";
import type { GameState } from "../src/state/types";

export interface TurnSummary {
  turn: number;
  year: number;
  month: number;
  topFaction: string | null;
  topCount: number;
  japanProvinces: number;
  gameOver: string | null;
}

export function summarizeState(state: GameState): TurnSummary {
  let top: string | null = null;
  let topCount = 0;
  for (const fid of Object.keys(state.factions)) {
    const c = controlledProvinceCount(state, fid);
    if (c > topCount) {
      topCount = c;
      top = fid;
    }
  }
  return {
    turn: state.turn,
    year: state.year,
    month: state.month,
    topFaction: top,
    topCount,
    japanProvinces: controlledProvinceCount(state, "japan"),
    gameOver: state.gameOver ? state.gameOver.reason : null,
  };
}

export interface SimulationOptions {
  seed?: number | string;
  turns: number;
  playerFactionId?: string;
  summaryEvery?: number; // 每 N 回合记一条摘要（缺省 12）
}

export interface SimulationResult {
  finalState: GameState;
  summaries: TurnSummary[];
  elapsedMs: number;
  turnsRun: number;
}

export function runSimulation(options: SimulationOptions): SimulationResult {
  const started = performance.now();
  let state = createInitialState({
    seed: options.seed ?? 1,
    playerFactionId: options.playerFactionId ?? "roc",
  });
  const every = options.summaryEvery ?? 12;
  const summaries: TurnSummary[] = [summarizeState(state)];
  let turnsRun = 0;
  for (let i = 0; i < options.turns; i += 1) {
    if (state.gameOver) break;
    const res = applyAction(state, { type: "END_TURN" });
    if (res.error !== null) break;
    state = res.state;
    turnsRun += 1;
    if (turnsRun % every === 0 || state.gameOver) {
      summaries.push(summarizeState(state));
    }
  }
  return { finalState: state, summaries, elapsedMs: performance.now() - started, turnsRun };
}
