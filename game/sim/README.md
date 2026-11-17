# Simulator

Full-AI matches (M2): the player faction idles (END_TURN only), all other
factions are driven by the rules AI through applyAction. The engine has no
turn cap; a run stops early only when a victory condition is met.

- `runSimulation({ seed, turns, playerFactionId })` returns periodic
  summaries (top faction by controlled provinces, Japan's province count,
  game-over reason) plus the final state and wall-clock time.
- Acceptance (tests/sim.test.ts): 300-turn runs across seeds do not crash,
  wars actually move borders, an idle player gets attacked, and a single
  END_TURN with all AI factions settles well under 1s.
