# Map dressing spec (A2 terrain reading + A6) — Asia Front

Projection (all layers): x=(lon-58)*cos30*11, y=(56-lat)*11, viewBox 1650x790.
Layer order: basemap_ne -> graticule -> rivers -> province tints (0.55) -> markers.

## A2 terrain textures (updated 2026-11-16, commander spec: 8 terrain types)
Tileable textures ARE now delivered (supersedes the earlier no-texture note):
terrain_{plains,forest,hills,mountain,jungle,desert,marsh,urban}.png, 256x256
seamless, muted/low-contrast, plus matching legend_{name}.png icons.
Layer order: basemap -> terrain texture (per-province pattern fill, clipped to
the province polygon) -> faction tint (0.55) -> markers. In terrain map mode
the code side may raise the texture's effective opacity; in political mode the
0.55 tint keeps the patterns quiet (verified in terrain_onmap.png).
Legend icons use the A4/A5 dark ink (51,43,32); invert to cream if the legend
bar background is dark.
- jungle 丛林: deep green tint rgba(24,66,32,0.16)
- desert 沙漠: warm sand tint rgba(176,138,74,0.14)
- city 城市: light warm tint rgba(150,120,80,0.10)
- island/port 岛屿港口: none (coastline reads from basemap)
Tileable texture PNGs are NOT needed with the realistic basemap; this spec
replaces the old atlas-style A2 texture plan.

## A6 grid + sea names
- graticule.svg: 10-degree graticule, white hairline opacity 0.16.
- sea_labels.json: 14 sea-name labels with viewBox anchors + rotation.
  Style: serif italic, #9db8c4, opacity 0.55, letter-spacing 0.35em,
  ~15 viewBox units. Render above the sea grade, below markers.
- Compass: reuse ui/compass_button.png art family if a map-corner compass is
  wanted (code-side placement, NE corner suggested).
