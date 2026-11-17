# ART RECEIPT - art line reply to ART-REQUIREMENTS.md (2026-11-16 03:29)
# Status per item, verified against files on disk in ~/workspace/ww2-asia/assets/

## A. Map
A1 TODO (vector). On hand: painted full-theater map (tiles/map_full_v1.png) + style sample - reference only, coastlines are painterly approximations, NOT a vector basemap.
A2 PARTIAL. palette.json has color specs for hills / jungle / desert / paddy(=plains) / sea (5). Missing: mountains / urban / island specs, and tileable PNG versions for all 7 (currently zero tileable files).
A3 TODO. No vector river layer. Rivers exist only painted inside the sample/full map (unusable as data). 8 rivers pending.
A4 DONE 5 + 1 extra, 1 gap. Have: city (normal), capital, port, airfield, fortress + battle marker (tiles/markers/). Missing: major-city tier (3 tiers required, 2 delivered).
A5 PARTIAL. Oil / steel / grain exist as UI medallion icons; rubber MISSING. All 4 still need small on-map versions.
A6 PARTIAL. Compass done (button + medallion). Missing: lat-long grid, sea-name label spec.

## B. Nations
B1 DONE. Flags 19/19, each visually verified (ui/flags/).
B2 TODO x18 - NEW item, not started. Biggest single gap. Open question for commander: Wang regime / Mengjiang are event-generated - portraits needed for them too? (then x20)
B3 TODO. Plan: derive from flags (shield/round crop) - no files yet. Separate emblems would be extra work if wanted.

## C. Units
C1 TODO x8 + faction-special markers.
C2 TODO x3.
C3 PARTIAL 3/10. Done: infantry, fighter, destroyer (models/*.glb, animated). Light tank only as flawed fallback (tank_light.glb - disc-like wheels, pale color; NOT a formal delivery). Missing x6: medium tank, artillery, bomber, cruiser, carrier, transport ship.
C4 PARTIAL 1/6 + 1 in progress. Done: Zero (= fighter_zero.glb). In progress: ROC German-equipped infantry - base mesh is the German-helmet soldier; 5 faction recolor textures finished (ROC khaki / IJA yellow-green / CCP grey-blue / US olive / UK brown; red armband painted over), variant GLBs not yet assembled. Missing x4: Type-95, T-34, Sherman, Soviet cavalry.
C5 TODO x5. Attack arrow exists only inside the UI mockup painting; no sliced marker files.
C6 NOT STARTED (manifest marks optional/later - noted, on the books).

## D. Interface & Atmosphere
D1 DONE. UI kit 44 files (13 icons, panel/button frames, divider, compass).
D2 TODO x2. Province info card exists only as concept inside the UI reference image; no production files.
D3 TODO x1. D4 TODO x1. D5 TODO x2.
D6 TODO x1. Suggestion: map_full_v1.png can double as the loading image - needs confirmation.

## E. Rules
License log NOT yet consolidated: license/source notes live inside the open-source research report; a single assets/LICENSES.md is TODO. ASCII filenames / transparent PNG / low-poly GLB rules are being followed.

## Suggested priority (art line's view)
B2 portraits (nation-select + diplomacy are blocked on faces) -> C1/C2 badges (every division on the map needs one) -> C3 remaining 6 -> A1/A3 (after the map-format decision) -> D2-D6.

## ADDENDUM 2026-11-16 03:30 - user decision: map style = REALISTIC
- User (art chat, 03:30): map must be realistic style, not the vintage atlas look.
- New style sample: tiles/map_realistic_sample_v1.png (satellite-style terrain, province polygons as translucent tints over real terrain).
- Impact: A1 becomes a realistic terrain basemap; A2 terrain items become realistic textures (relief mountains / forest canopy / desert sand); province fills switch to translucent tints so terrain reads through. The atlas-style samples (map_style_sample_v1, map_full_v1) are retired as style references. Full realistic map waits for the code line's province draft so borders align with real province data.

## UPDATE 2026-11-16 03:36 - infantry recolors DONE
- 5 variant GLBs in assets/models/: infantry_roc / infantry_japan / infantry_ccp / infantry_usa / infantry_uk .glb - same mesh/animations (idle/march/attack/die verified in file), faction uniform textures (ROC khaki / IJA yellow-green / CCP grey-blue / US olive / UK brown), stock red armband painted over. ROC variant visually verified by render.
- C4 ROC German-equipped infantry: DONE (= infantry_roc.glb, German helmet + ROC khaki).

## ADDENDUM 2026-11-16 03:34 - user decision: A1 uses a REAL map base
- User (art chat, 03:34): when the time comes, use a real map directly and the art line optimizes it.
- A1 route changed: real geographic data (satellite imagery / SRTM-style shaded relief; Natural Earth is public domain = cleanest license) as the basemap, art line does the optimization pass: game-readability color grading, sea treatment, alignment to the code line's province polygons, tint/border/marker layers on top. The AI realistic sample stays as the style target for how the optimized result should feel.
- Trigger: code line's province draft finalized. No AI-painted full map will be produced.

## UPDATE 2026-11-16 03:40 - B2 batch 1 (3/18)
- Roster fixed from game/src/data/factions.ts leader cards (18): Chiang Kai-shek / Mao Zedong / Yan Xishan / Hirohito / Puyi / Wang Jingwei / Demchugdongrub / Phraya Phahon / F. Roosevelt / Baldwin / Colijn / Leon Blum / Stalin / Choibalsan / Ho Chi Minh / Aung San / Bose / Quezon. Wang + Mengjiang ARE inside the 18, so no extra count question.
- Done (ui/leaders/, 512x512): leader_roc (Chiang, khaki tunic), leader_ccp (young Mao, grey-blue tunic, cave HQ), leader_japan (Hirohito, glasses + imperial dress uniform). Painterly, consistent.
- Puyi (manchukuo): generation did not go through this round - open gap, alternative treatment to be decided (e.g. emblem-style placeholder), not silently dropped.

## UPDATE 2026-11-16 03:44 - B2 batch 2 (7/18)
- Done: leader_warlords (Yan Xishan), leader_wangjingwei, leader_mengjiang (Prince De, deel + fur hat), leader_thailand (Phraya Phahon). Style consistent with batch 1.
- Remaining 11: usa / uk / netherlands / france / ussr / mongolia / vietminh / bna / ina / philippines + manchukuo (Puyi, alternative TBD).

## UPDATE 2026-11-16 03:48 - B2 batch 3 (11/18)
- Done: leader_usa (FDR, pince-nez + grin), leader_uk (Baldwin), leader_netherlands (Colijn), leader_france (Blum, glasses + moustache). Note: Baldwin/Colijn read similar (elderly statesmen in dark suits) - acceptable at UI size with name labels.
- Remaining 6: ussr / mongolia / vietminh / bna / ina / philippines + manchukuo gap.

## UPDATE 2026-11-16 03:52 - B2 batch 4 (14/18)
- Done: leader_ussr (Stalin), leader_mongolia (Choibalsan), leader_vietminh (Ho Chi Minh).
- Aung San (bna): generation did not go through, same as Puyi. Two portrait gaps now (manchukuo, bna) - proposal: emblem/silhouette-style placeholders in the same frame so the UI never shows a hole; final call rests with user/commander.
- Remaining: ina (Bose), philippines (Quezon).

## UPDATE 2026-11-16 03:56 - B2 essentially complete (16/18)
- Done: leader_ina (Bose, INA cap + tiger patch), leader_philippines (Quezon). All 16 in ui/leaders/ at 512x512, one painterly family.
- Only gaps: manchukuo (Puyi) + bna (Aung San) - generation did not go through for either. Blocked on user/commander decision: emblem-style placeholders (art line's proposal) or another treatment.

## UPDATE 2026-11-16 04:05 - C1 + C2 DONE
- ui/badges/ (256x256 transparent PNG x13): div_infantry / div_mountain / div_cavalry / div_motorized / div_armor / div_marine / div_garrison / div_guerrilla + div_special (blank plaque + cream star, for faction-special divisions); sup_fighter / sup_bomber / sup_fleet + sup_blank (empty plaque for code-side compositing).
- Same riveted brass plaque family as the UI kit. Slicer: ui/slice_badges.py (closing pass bridges the dark groove between rim and face).

## UPDATE 2026-11-16 04:12 - C3 ships + medium tank DONE
- models/cruiser.glb (3 twin turrets, floatplane, 2 funnels, 4 clips, 1036 tris), carrier.glb (full flight deck, starboard island, 5 deck planes, 680 tris), transport.glb (3 cargo hatches, cranes, deepened hull, 444 tris) - build_ships2.py, all with FactionBand + idle/move/attack/die.
- models/tank_medium.glb (build_tank2.py, 1580 tris, 43 meshes, 4 clips incl. whole-tank recoil in attack; road wheels outboard and visible). Supersedes nothing - tank_light.glb remains the light-tank placeholder pending the user's Sketchfab-vs-selfbuild call.
- Remaining C3 builds: artillery, bomber, motorized truck, cavalry, infantry kit variants (mountain/marine/garrison/guerrilla).

## UPDATE 2026-11-16 04:18 - C3 artillery + bomber DONE
- models/artillery.glb (build_gun_bomber.py): towed field gun - elevated barrel + muzzle, shield with wings, spoked wheels, split trails with spades; 4 clips (attack = whole-gun recoil rock), 828 tris.
- models/bomber.glb: twin-engine medium bomber - glass nose, dorsal turret, twin tail fins, prop blades + translucent discs, FactionBand wing roundels; flight clips, 1044 tris.
- Remaining C3: motorized truck, cavalry, infantry kit variants (mountain/marine/garrison/guerrilla).

## UPDATE 2026-11-16 04:32 - C4 COMPLETE (6/6)
- models/t34.glb (5 Christie wheels, steep glacis, long 76mm, soviet green), sherman.glb (tall hull, 6 bogie wheels, muzzle brake), type95.glb (small Ha-Go: 4 wheels, short gun, khaki-grey) - build_c4_tanks.py parameterized builder, all 4 clips.
- models/cavalry_ussr.glb (build_cavalry.py): horse + rider with budenovka (cone tip + red star badge), raised shashka, carbine on back, FactionBand saddle blanket; gallop-bob move / charge attack / fall die; 620 tris. Stylized low-poly - reads clearly at map scale, crudest finish of the set.
- C4 full set: fighter_zero / type95 / t34 / sherman / infantry_roc / cavalry_ussr.
- C3 note: manifest check showed C3 generic set is x10 (no truck/cavalry/kit variants - those exist as C1 badges only). C3 complete except formal light tank (user decision pending).

## UPDATE 2026-11-16 04:40 - C5 DONE
- tiles/markers/combat_{attack,encircle,airraid,landing,guerrilla}.png - round riveted medallions, bold pictograms (red arrow / circling red arrows / bomb+burst / arrow-from-waves / dagger+starburst), 256x256 transparent, sliced by tiles/slice_combat.py. Verified on map-green preview (tiles/combat_markers_preview.png).

## UPDATE 2026-11-16 04:48 - D3/D4/D5 DONE
- ui/bg/bg_main_menu.png (war room, dividers over Asia map table), bg_nation_select.png (map wall + row of period flags, calm dark center), bg_victory.png (dawn flag-raising over a Chinese town), bg_defeat.png (ruined city, lone soldier on rubble). All painterly, no readable text. Remaining D: D6 loading, D2 province card + state panel frames.

## UPDATE 2026-11-16 04:56 - D GROUP COMPLETE
- ui/bg/bg_loading.png (dawn convoy, calm dark water below for the loading bar).
- ui/province_card_frame.png (brass riveted card, brass-framed picture window upper area, blank text area below; transparent outside) + ui/state_panel_frame.png (tall panel with header band; transparent outside) - D2 done in the D1 kit family.

## UPDATE 2026-11-16 05:02 - E DONE
- assets/LICENSES.md compiled: OGA CC0 soldier (infantry base + 5 recolors), Wikimedia PD flags x19, Quaternius CC0 tank logged as present-but-unused, Spring:1944 logged as rejected (NC), all other assets logged as project-original; Natural Earth pre-logged as planned for A1.

## UPDATE 2026-11-16 05:10 - A4/A5 DONE
- markers/marker_major_city.png (ring + skyline, matches the existing flat-outline A4 family) - A4 now complete: 3 city tiers + port/airfield/fortress/battle.
- markers/res_{oil,steel,rubber,grain}_map.png - small on-map resource icons in the same flat style (droplet / ingot stack / tire / wheat sheaf), drawn by tiles/draw_a4a5.py. A5 done.

## UPDATE 2026-11-16 12:40 - D1 rubber icon done; A1 trigger reached
- ui/icons/res_rubber.png (cream rubber tree + tapping slash + brass cup, same medallion family) - top-bar resource set now complete x5 (oil/steel/grain/rubber + industry/manpower from kit).
- Commander sync: W1 provinces FINAL (54 states / 197 provinces, viewBox 1650x790; projection in game/tools/gen_map.py: x=(lon-58)*cos30*11, y=(56-lat)*11). A1 basemap unblocked - in production (Natural Earth PD; official CDNs 403 via proxy, mirrors being probed).

## UPDATE 2026-11-16 12:52 - A1 DONE
- tiles/basemap_ne_2x.png (3300x1580) + basemap_ne_1x.png (1650x790): Natural Earth NE1 50m color+relief (public domain; via nvkelso GitHub mirror after official CDNs 403/404), cropped to the exact game frame (lon 58..231.21 incl. antimeridian wrap, lat 56..-15.82), anisotropic resize = the game projection itself. Sea re-graded deep slate w/ latitude gradient + faint bathy relief; land gentle desat/warm + soft extra relief. Alignment VERIFIED: Tokyo/Shanghai/HongKong/Delhi/Bangkok/Singapore/Harbin/Honolulu plotted from real lon/lat all land on the correct coasts (tiles/basemap_check.png). Drop under the 0.55 province tints as-is.

## UPDATE 2026-11-16 13:00 - A3 + A6 DONE, A2 REDEFINED
- tiles/rivers.svg + rivers.json: 8 rivers (Yangtze/Yellow/Pearl/Mekong/Amur/Ganges/Irrawaddy/Salween) from NE 10m centerlines (PD), projected to the game frame, DP-simplified. Pearl = Nanpan+Hongshui+Xun+Xi main-stem chain (NE "Pearl" is the US river - excluded). Verified visually over the basemap (tiles/rivers_check.png): Yellow's Ordos loop, Yangtze to Shanghai, Mekong to its delta, Amur border arc all trace correctly.
- tiles/graticule.svg (10-deg, hairline 0.16) + tiles/sea_labels.json (14 sea names w/ anchors+rotation+style) + tiles/MAP-DRESSING-SPEC.md (layer order; A2 closed as a per-terrain tint spec on the realistic basemap - tileable textures not needed).
- ART MANIFEST COMPLETE except: B2 two portraits (user decision pending) + light tank formal version (user decision pending).

## UPDATE 2026-11-16 12:58 - A1 v2 satellite candidate (user: v1 style feels wrong)
- Diagnosis accepted: NE1 is atlas-painted color (pale, flat) - not a satellite look. v2 built from NASA Blue Marble NG + shaded relief/bathymetry rendered by GIBS WMS directly into the game frame (eoimages/NEO were dead ends; GIBS epsg4326 best WMS worked): tiles/basemap_sat_2x.png + basemap_sat_1x.png. Grade: land saturation/contrast up, sea pulled toward deep slate keeping bathymetry texture, NE-derived sea mask reused. Alignment re-verified with the same 8 cities. v1 (basemap_ne_*) kept until the user approves the swap.

## UPDATE 2026-11-16 13:12 - B2 COMPLETE 18/18 (photo route, user decision)
- leader_manchukuo.png: Puyi, from Wikimedia PD photo "Aisin-Gioro Puyi 01.jpg" (Tianjin-era seated portrait), head+shoulders crop, warm sepia grade + backdrop defocus (ui/process_portraits.py). Source is a garden shot - bright foliage ring behind the head kept from the original (further suppression would damage the face); noted to the user with a backdrop-replacement option if wanted.
- leader_bna.png: Aung San, from Wikimedia PD photo "Aung San in uniform.jpg" (BIA uniform), same grade. Clean result.
- Both 512x512 in ui/leaders/. LICENSES.md updated (1.4).

## UPDATE 2026-11-16 13:20 - B2 painted versions (user ordered a retry; generation succeeded)
- leader_manchukuo.png + leader_bna.png REPLACED with painted oil portraits (same family as the other 16; likeness verified against the historical photos). Photo versions kept as leader_manchukuo_photo.png / leader_bna_photo.png backups. Raws in leaders_raw/ (media-generation-leader-*-paint-*).

## UPDATE 2026-11-16 13:32 - B2 style harmonization (user: painted pair did not match the other 16)
- Reference-image repaint attempts did not generate this round. Fallback applied: finish-level harmonization of the two paintings toward the family (down-up resample to kill photographic micro-detail, soft posterize, palette statistics matched to leader_japan / leader_ccp). Harmonized versions are now the live leader_manchukuo.png / leader_bna.png; previous painted versions kept as *_paint_v1.png, photo versions as *_photo.png. Comparison strip: ui/leaders/style_compare.png. Gap narrowed, not claimed perfect - user to judge.

## UPDATE 2026-11-16 13:45 - A2 terrain expansion delivered (commander sync, HOI4 terrain system)
- 8 tileable textures 256x256, seamless (FFT periodic noise + wrapped motifs), muted/low-contrast, in assets/tiles/: terrain_{plains,forest,hills,mountain,jungle,desert,marsh,urban}.png. Builder: assets/tiles/build_terrain.py.
- 8 matching legend icons 256x256 transparent, same dark-ink family as A4/A5: legend_{same names}.png. If the legend bar is dark, invert to cream - one-line CSS filter, noted for code side.
- Verified: tiling sheet (2x2 repeats, no seams) tiles/terrain_sheet.png; on-map test tiles/terrain_onmap.png (texture at 45% over satellite crop reads clearly; under a 0.55 red faction tint the patterns go quiet and do not fight the ownership color).
- Island texture dropped per new spec (islands are A4 features). A1 note: with Honolulu removed (196 provinces) and provinces being reworked to real admin boundaries, the basemap/rivers/graticule will be re-projected once the code side fixes the new frame - textures/icons here are frame-independent and unaffected.

## UPDATE 2026-11-16 14:20 - Main-UI skin kit delivered (per art review for code side)
- assets/ui/topbar_plate.png (640x96 riveted steel, seamless repeat-x, cropped from the approved UI reference) + bottombar_plate.png (640x96 canvas + brass edge, seamless).
- assets/ui/btn_square.png 256 (square brass button seat), tab_on.png / tab_off.png 320x180 (tab plates), btn_endturn.png 320x180 (dark-red enamel end-turn). Slicer: assets/ui/slice_skin.py.
- Mount notes + border-image slice estimates for the older frames: assets/ui/SKIN.md. Preview: assets/ui/skin_preview.png.

## NOTE 2026-11-16 19:25 - Asset registry rule received
- ASSET-REGISTRY.md is now the single source of truth. Art side verified its full stock against the registry line by line: all present (3D set, terrain/legend x8, rivers, graticule, sea labels, res markers, combat markers, leaders x18 painted + 2 photo backups, icons 13/13, D skins incl. plates/buttons/tabs/end-turn, backgrounds). New deliveries from now on are reported for registration (path + use + license) at delivery time; unregistered = not delivered.
- One nuance flagged to the commander: tank_light.glb is registered as a regular deliverable, while the art side's record had it as a placeholder self-build. Art side defers to the registry as the single口径.

## UPDATE 2026-11-16 21:00 - Audio line v1: audition pack delivered (for ASSET-REGISTRY "audio" class)
- 6 music ogg (assets/audio/music/): menu loop (Wagner Siegfried funeral march, PD), war loops x3 (Sousa marches, US Marine Band, PD), victory/defeat stings (PD / CC0 Chopin). Loop-crossfaded.
- 19 sfx ogg (assets/audio/sfx/): UI clicks/panels/tabs, order confirms, battle start/loop/stings, province captured/lost, telegraph event, war drums, peace chime, air-raid siren, HQ ambience loop. ALL self-synthesized (build_sfx.py, no samples), project-original.
- Full sourcing/license/production list: assets/audio/AUDIO-LIST.md. Audition pack: assets/audio/audio_audition_pack.zip (25 files + list). Awaiting commander audition before final mix/level pass.

## UPDATE 2026-11-16 21:05 - Audio v1.1: HOI4 style-benchmark annotation (user-authorized style imitation)
- User authorized modeling timbre/rhythm on HOI4's sound design per scene (style only, no ripped audio; sourcing stays CC0/PD/self-made). AUDIO-LIST.md now carries a benchmark map: every music/SFX item annotated with the HOI4 scene it is modeled on.
- Timbre pass under that authorization: sfx_ui_click thickened (chunkier clack), sfx_declare_war gained a low brass swell under the drums (now 1.6s). Audition zip rebuilt.
