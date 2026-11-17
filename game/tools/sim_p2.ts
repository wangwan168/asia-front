// 二期 sim：2 种子 × 300 回合全 AI 跑局（崩溃/非法动作/任务指派活跃度）
import { createInitialState } from "../src/state/createInitialState";
import { applyAction } from "../src/core/applyAction";

for (const seed of [11, 42]) {
  let s = createInitialState({ seed, playerFactionId: "roc" });
  let errors = 0;
  const t0 = Date.now();
  for (let i = 0; i < 300; i++) {
    const r = applyAction(s, { type: "END_TURN", factionId: "roc" });
    if (r.error) { errors++; console.log(`seed ${seed} turn ${i}: END_TURN error ${r.error}`); break; }
    s = r.state;
  }
  const missioned = s.supports.filter((x) => x.missionTargetId !== x.provinceId).length;
  const alive = Object.values(s.factions).filter((f) => f.alive).length;
  console.log(`seed ${seed}: 300 turns ok, errors=${errors}, ${Math.round((Date.now() - t0) / 300)}ms/turn, alive factions=${alive}, supports on non-home mission=${missioned}/${s.supports.length}, year=${s.year}`);
}
