# ASIA FRONT (ww2-asia) - Status
# User decision 2026-11-16: Daqing Jinglue CANCELLED, replaced by this project.
# Theme: WWII Asia theater grand strategy, Hearts of Iron as mechanics reference (borrow mechanics, no copy).

## Locked decisions (user, 2026-11-16)
- Start: Jan 1936. Turn = 1 month. NO turn limit - game ends only on victory/defeat conditions; scripted history runs to 1945, war may continue past it.
- Map: Asia - Manchuria/Outer Mongolia (N) to northern Indonesia (S), Burma-India border (W) to Taiwan/Ryukyu (E). ~60 land cities + ~20 port/island nodes. Sea tiles matter: navy/air are real systems.
- Factions draft (18). PLAYER CHOOSES ANY FACTION at game start (user 2026-11-16: must be able to play other nations; ROC is only the default highlight, never hard-coded as player). Every faction needs a playable start + full AI personality/persona for when AI-run.: ROC, CCP (8th Route/New 4th Army), warlords (merged), Japan, Manchukuo, Wang Jingwei regime, Mengjiang, Thailand, USA, UK, Netherlands, France, USSR, Mongolian PR, Viet Minh, Burma National Army, Indian National Army, Philippine guerrillas; neutrals Tibet/Xinjiang TBD.
- Engine: reuse daqing-jinglue architecture (data-driven, applyAction single entry, fixed-seed RNG, save slots, rule AI + optional LLM diplomacy dialog). Daqing data/architecture archived in place at ~/workspace/daqing-jinglue/, do not modify.
- Standing rules carry over: faction total-strength parity (only playstyle differs), per-faction AI personality + leader persona cards, game fully playable with NO LLM connected (LLM dialog is an extra negotiation channel only), troops counted in real headcount (division-scale, infantry division ~10k men), difficulty = one unified AI multiplier table only, all numbers in src/data, staged delivery with tests.

## Pipeline
- Commander chat (1bb07314): direction, tasking, verification, user reporting.
- Code chat (76ec09f7): implementation in ~/workspace/ww2-asia/game/.
- Art chat (3dca35d0): visuals/units (user briefed Asia scope there 2026-11-16).

## Current step
- Code chat tasked 2026-11-16: stop Daqing 3A, scaffold ww2-asia/game from Daqing engine (no Daqing data), timeline constants (1936 start, monthly, no cap), engine tests green.
- Next: commander issues data package spec (nations/provinces/division templates/industry/research/focus) for user confirmation.

## Overnight run (user authorized 2026-11-16 02:07: "proceed, I want v1 by morning")
- Code chat on night orders: M1 data pack (18 factions / ~80 nodes / division templates / economy / tech / focuses / events 1936-45) -> M2 logic loop (monthly settlement, production, combat, supply-lite, rule AI, diplomacy, event triggers, per-faction victory goals) -> M3 playable UI (nation select + map + panels) -> M4 package asia-front-v1.zip with tests green.
- CONFIRMED by user 2026-11-16 02:09 ('use what really existed'): starting strength follows historical tiers (NOT Daqing 5% parity); playability via historical tiers only. VICTORY IS UNIFIED for all factions (user 2026-11-16 02:10 correction, overrides per-faction victory goals - DELETED): win = control >=70% of province nodes or all others eliminated/subjugated; lose = zero provinces. Factions instead carry a display-only difficulty label (easy/normal/hard/hell + one-line reason) at nation select, no numeric effect. Historical grounding is binding: real 1936 control map (Manchukuo/Korea/Taiwan under Japan, CCP only Shaanbei base, colonial holdings as historical), real leaders, real resource locations, real event timeline; Wang regime (1940) and Mengjiang (1939) spawn via events as dormant factions. Flags: art line uses actual WWII-era national flags per user order there.

## Map switch to HOI-style (user decided 2026-11-16 03:27, effective immediately)
- Polygon provinces on real geography + state layer (industry/population on states, war on provinces); terrain per real landforms; rivers on province borders (crossing penalty); adjacency = shared borders + sea links. Engine graph logic unchanged.
- Code chat on W1 (province/state draft from 1936 admin boundaries, ~45-55 states / ~170-200 provinces, geometry from public boundary data) -> W2 (data migration + SVG polygon renderer) -> W3 (tests/sim re-run, asia-front-v2.zip). Live node-map version stays up until the new map replaces it wholesale.
- Art manifest (ART-REQUIREMENTS.md) sent to art line itemized A1-D6 with per-item receipt required; leader portraits x18 added (previously missing everywhere).
- STANDING RULE (user 2026-11-16 03:43): every finished art asset MUST be integrated into the game - code line keeps an art-integration ledger in PROGRESS.md (per ART-REQUIREMENTS A1-D6: delivered / integrated-in-version / pending+why); commander acceptance fails if delivered art sits unused without a stated reason.
