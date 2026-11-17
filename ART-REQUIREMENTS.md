# ASIA FRONT - Art Requirements Manifest (commander -> art line, 2026-11-16)
# Rule: itemized so nothing goes missing. Art line must reply item-by-item: done / in progress / todo / count.
# Map items assume the HOI-style polygon province map (real geography). Basemap/rivers/terrain items are needed either way.

## A. Map (HOI-style polygon provinces)
A1 Basemap reference: real Asia coastline + island outlines (vector), land/sea base tones.
A2 Terrain visuals: 8 subtle tileable patterns + matching legend icons - plains / forest / hills / mountain / jungle / desert / marsh / urban. Patterns must remain readable under translucent faction tint (terrain map mode). Port / capital / island are feature markers (A4), not terrain textures.
A3 River layer: major rivers as vector lines matching real courses (Yangtze, Yellow, Pearl, Mekong, Heilongjiang/Amur, Ganges, Irrawaddy, Salween) - aligns to province borders for river-crossing rules.
A4 Map markers: city dots (normal / capital / major city = 3 tiers), port anchor, airfield, fortress.
A5 Resource map icons (small, on-map): oil / steel / rubber / grain.
A6 Map dressing: compass, optional lat-long grid, sea-name label style spec.

## B. Nations
B1 Flags x19 (WWII-era real flags) - DONE, verified.
B2 Leader portraits x18: one per faction leader, painterly style, unified 1:1 spec. (NEW - was missing from all earlier lists.)
B3 Nation select / diplomacy emblem variant per faction (can derive from flag; flag-based is acceptable if stated).

## C. Units
C1 Division map badges x8: infantry / mountain / cavalry / motorized / armor / marine / garrison / guerrilla + faction-special marker.
C2 Support badges x3: fighter / bomber / fleet.
C3 3D models, generic: infantry, light tank, medium tank, artillery, fighter, bomber, destroyer, cruiser, carrier, transport ship (x10).
C4 3D models, signature: Zero fighter, Type-95 light tank, T-34, Sherman, ROC German-equipped infantry, Soviet cavalry (x6, extendable).
C5 Combat/event map markers x5: attack arrow, encirclement, air raid, amphibious landing, guerrilla raid.
C6 (Optional, later) Event illustrations for the 19 scripted events.

## D. Interface & Atmosphere
D1 UI kit (icons x13, panel frames, buttons, compass button) - DONE (44 files).
D2 New for province map: province info card style + state panel style (match D1 kit).
D3 Main menu background x1 (war-room / Asia map table mood).
D4 Nation-select background x1.
D5 Victory / defeat screens x2.
D6 Loading image x1.

## E. Production rules (apply to every item)
- Icons/badges: transparent PNG; textures: tileable PNG; models: GLB, low-poly spec as before.
- File names: English ASCII only.
- Open-source first (user rule): every third-party asset logged in a license file (source + license + attribution text); CC0/CC-BY only, no NC.
- Portraits/flags: historical accuracy (real people likeness in painterly style, real WWII-era flags).
