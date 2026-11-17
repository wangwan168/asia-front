# Asia Front audio - sourcing/production list v1.1 (audition pack, 2026-11-16)
Style benchmark (user-authorized 2026-11-16): timbre/rhythm modeled on HOI4's sound design per scene; style imitation only - no HOI4 audio files used or sampled.
All items CC0 / public domain / self-made. No copyrighted recordings or OST material.
Deliverables: music/*.ogg (stereo), sfx/*.ogg (mono). Builders: process_music.py, build_sfx.py.
Source recordings kept in music_src/ for provenance.

## Music (atmosphere layer)
Benchmark scenes (HOI4): music_menu = main-menu music slot; music_war_1..3 = wartime in-game music rotation; music_victory / music_defeat = victory / defeat settlement music slots.
| file | use | dur | source work / performer | license | production |
|---|---|---|---|---|---|
| music_menu.ogg | main menu / nation select, solemn orchestral loop | 80s loop | Wagner, Siegfried's Funeral March (Gotterdammerung), Commons file "Siegfrieds funeral march and finale.ogg" | Public domain | excerpt 0:40-2:05, 5s loop crossfade, peak-norm |
| music_war_1.ogg | wartime main UI loop rotation 1 | 88s loop | Sousa, The Stars and Stripes Forever - US Marine Band (dir. Bourgeois) | Public domain (US federal work) | excerpt, 4s loop crossfade |
| music_war_2.ogg | wartime loop rotation 2 | 88s loop | Sousa, Semper Fidelis - US Marine Band | Public domain (US federal work) | excerpt, 4s loop crossfade |
| music_war_3.ogg | wartime loop rotation 3 | 88s loop | Sousa, The Glory of the Yankee Navy - US Marine Band (1978) | Public domain (US federal work) | excerpt, 4s loop crossfade |
| music_victory.ogg | victory settlement sting | 14s | Stars and Stripes Forever finale, same recording as war_1 | Public domain | closing strain, fades |
| music_defeat.ogg | defeat settlement sting | 14s | Chopin, Funeral March Op.72 No.2, Commons recording | CC0 (composition 1827, PD) | opening, long fade-out |

## SFX (feedback layer) - ALL self-synthesized (oscillators + filtered noise, zero samples), project-original
| file | use | dur |
|---|---|---|
| sfx_ui_click.ogg | button click, mechanical/radio knob | 0.08s |
| sfx_ui_tab.ogg | tab switch | 0.05s |
| sfx_ui_panel_open.ogg / sfx_ui_panel_close.ogg | panel open / close | 0.42s |
| sfx_order_march.ogg | move order confirm (radio click + squelch) | 0.5s |
| sfx_order_attack.ogg | attack order (triple click + drum tap) | 0.55s |
| sfx_order_garrison.ogg | garrison order | 0.45s |
| sfx_order_cancel.ogg | cancel order | 0.35s |
| sfx_battle_start.ogg | battle opens, distant artillery | 4.2s |
| sfx_battle_loop.ogg | battle ongoing ambience (loopable) | 24s loop |
| sfx_battle_victory.ogg | battle won sting | 1.3s |
| sfx_battle_defeat.ogg | battle lost sting | 1.9s |
| sfx_province_captured.ogg | province captured (telegraph ticks + chime) | 0.9s |
| sfx_province_lost.ogg | province lost (low warning) | 0.8s |
| sfx_event_telegraph.ogg | historical event popup (typewriter + bell) | 1.5s |
| sfx_declare_war.ogg | declaration of war (war drums + brass swell) | 1.6s |
| sfx_peace.ogg | armistice / alliance chime | 1.1s |
| sfx_airraid.ogg | air-raid siren (air raid marker) | 12s |
| amb_hq_loop.ogg | HQ room tone, very low (toggleable) | 30s loop |

## SFX benchmark map (HOI4 scene each item is modeled on)
| our file | HOI4 benchmark scene |
|---|---|
| sfx_ui_click.ogg | interface button click (chunky mechanical clack) - v1.1 thickened low-mid body |
| sfx_ui_tab.ogg | interface tab switch click |
| sfx_ui_panel_open/close.ogg | panel / window open-close |
| sfx_order_march.ogg | unit move-order confirm (radio click + squelch) |
| sfx_order_attack.ogg | attack / battle-plan order confirm |
| sfx_order_garrison.ogg | garrison / area-defence order confirm |
| sfx_order_cancel.ogg | cancel / dismiss click |
| sfx_battle_start.ogg | battle initiation (distant artillery opens) |
| sfx_battle_loop.ogg | open-battle ambience loop (artillery + gunfire bed) |
| sfx_battle_victory.ogg | battle won result sting |
| sfx_battle_defeat.ogg | battle lost result sting |
| sfx_province_captured.ogg | state captured notification |
| sfx_province_lost.ogg | state lost notification (low warning) |
| sfx_event_telegraph.ogg | event / news popup (paper-telegraph feel) |
| sfx_declare_war.ogg | war declaration sting (heavy drums) - v1.1 added low brass swell |
| sfx_peace.ogg | peace / armistice confirmation |
| sfx_airraid.ogg | air-raid siren over bombed states |
| amb_hq_loop.ogg | map-screen background ambience (very low) |

## Notes for the commander / code side
- Loop points are crossfaded (music 4-5s, battle loop 1.5s, HQ ambience 2s); fine-tune after audition.
- Music is peak-normalized only; final mix levels belong to code side (suggest music -14 LUFS-ish under SFX).
- If file size matters, music can drop to vorbis q2 (~40% smaller) with little audible loss on the marches.
