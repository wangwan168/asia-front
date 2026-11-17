# 《亚洲战场》美术素材授权汇编 (Asset Licenses)

Compiled 2026-11-16 by the art line. Rule for this project: open-source first;
only CC0 / CC-BY / public-domain material may enter the asset tree, never NC.

## 1. Third-party material actually used

### 1.1 Rigged Lowpoly WW2 Soldier — OpenGameArt.org
- Source: OpenGameArt.org, asset page "Rigged Lowpoly WW2 Soldier"
  (saved page copy: `assets/models/opensource/oga_soldier_page.html`;
  source files: `assets/models/opensource/lowpolysoldier.zip`, `soldier_oga/`).
- License: **CC0** (as listed on its OpenGameArt page). No attribution required;
  credited here voluntarily.
- Used in: `assets/models/infantry_ww2.glb` (mesh + rig; animations idle/march/
  attack/die were keyed in-house; a procedural rifle was added in-house).
- Derivatives (in-house texture recolors via `opensource/recolor_tex.py`):
  `infantry_roc.glb`, `infantry_japan.glb`, `infantry_ccp.glb`,
  `infantry_usa.glb`, `infantry_uk.glb`.

### 1.2 National flags — Wikimedia Commons
- Source: Wikimedia Commons (`Special:FilePath`, fetched by
  `assets/ui/fetch_flags.py`).
- License: **public domain** (national flags are not copyrightable subject
  matter; the Commons files used are PD-flag renderings).
- Used in: `assets/ui/flags/flag_*.png` (19 flags).

### 1.4 Leader photographs (B2 gap fillers) — Wikimedia Commons
- `leader_manchukuo.png`: from "Aisin-Gioro Puyi 01.jpg" (Wikimedia Commons,
  **public domain**), Tianjin-era portrait of Puyi; cropped + warm sepia grade
  in-house (`assets/ui/process_portraits.py`). Raw in `leaders_raw/`.
- `leader_bna.png`: from "Aung San in uniform.jpg" (Wikimedia Commons,
  **public domain**), Aung San in BIA uniform; same treatment.
- Chosen by the user (2026-11-16) after image generation for these two
  portraits did not go through; the other 16 leaders are in-house paintings.

## 2. Third-party material present but NOT used in deliveries

- **Quaternius tank** (`assets/models/opensource/quaternius_tank.glb`) — CC0
  (Quaternius, via Poly Pizza). Downloaded as a style reference / placeholder
  only; no delivered model derives from it. `tank_light.glb` is an in-house
  procedural build.
- Research report: `~/workspace/research_notes/ww2-open-source-models/report.md`
  lists further verified sources (Sketchfab CC-BY tanks etc.) that were
  **not** downloaded or used.

## 3. Rejected sources (do not use)

- **Spring: 1944** assets — CC-BY-NC-SA / non-free per the project wiki.
  Non-commercial clause: rejected.
- Any asset whose license could not be verified on its own listing page.

## 4. Original project assets (no third-party license)

Everything below was created for this project (procedural Blender builds —
scripts kept beside the models in `assets/models/build_*.py` — or artwork
generated/painted in-house):

- 3D: `destroyer.glb`, `cruiser.glb`, `carrier.glb`, `transport.glb`,
  `fighter_zero.glb`, `bomber.glb`, `artillery.glb`, `tank_light.glb`,
  `tank_medium.glb`, `t34.glb`, `sherman.glb`, `type95.glb`, `cavalry_ussr.glb`.
- 2D: leader portraits (`assets/ui/leaders/`), division & support badges
  (`assets/ui/badges/`), combat markers (`assets/tiles/markers/combat_*.png`),
  map markers, UI kit (`assets/ui/icons/`, frames), backgrounds
  (`assets/ui/bg/`), province/state frames.

### 1.3 Natural Earth vector rivers — OpenGameArt-free, public domain
- Source: Natural Earth 10m rivers/lake centerlines (geojson), fetched from
  the nvkelso/natural-earth-vector GitHub mirror (official CDN unreachable).
- License: **public domain** (Natural Earth).
- Used in: `assets/tiles/rivers.svg` / `rivers.json` (8 rivers projected to
  the game frame; builder: `assets/tiles/build_rivers.py`). Note: NE's
  Chinese Pearl River main stem is stored as Nanpan/Hongshui/Xun/Xi reaches;
  NE's feature literally named "Pearl" is the US river and was excluded.

## 5. Natural Earth raster (A1 basemap) — used

- **NE1_50M_LC_SR_W** (land color + shaded relief, with water) and
  **GRAY_50M_SR** (gray shaded relief), 50m rasters, 10800x5400.
- License: **public domain** (Natural Earth).
- Route: official CDNs were unreachable from this network (403/404), files
  were fetched from the nvkelso/natural-earth-raster GitHub mirror;
  source copies kept in `assets/tiles/basemap_src/`.
- Used in: `assets/tiles/basemap_ne_2x.png` / `basemap_ne_1x.png`
  (cropped to the game projection frame lon 58..231.2 / lat 56..-15.8,
  sea re-graded in-house; builder: `assets/tiles/build_basemap.py`).
