# Main-UI skin kit (art side, 2026-11-16) - mount notes for code side
All files in assets/ui/. Bars are plain repeat-x backgrounds (no 9-slice needed).
- topbar_plate.png 640x96: riveted steel strip, horizontally seamless.
  CSS: background: url(topbar_plate.png) repeat-x left top / auto 100%.
  Use for the top bar and the resource bar.
- bottombar_plate.png 640x96: canvas + brass top edge, seamless.
  Same repeat-x usage for the bottom function bar.
- btn_square.png 256x256 (transparent corners): square brass button seat.
  Bottom-bar entries and map zoom keys; put nav_*.png icons centered on top
  (icon ~62% of the button). Selected state: add CSS brightness(1.25)
  + warm drop-shadow, or swap to tab_on material.
- tab_on.png / tab_off.png 320x180: right-panel tab plates, selected / idle.
  Text sits on the blank center.
- btn_endturn.png 320x180: dark-red enamel hero button (end turn, far right
  of the bottom bar). Remove the duplicate end-turn button from the top bar;
  top-right becomes date counter + player flag.
- compass_button.png 512x512 (existing): bottom bar center, map overview /
  recenter. Standing rule: center, never overlapping other buttons.
- Existing frames: panel_frame.png / button_frame.png / province_card_frame.png
  / state_panel_frame.png are full-frame paintings; if code side wants
  border-image, slice insets approx: panel_frame 90/120, button_frame 60/40,
  province_card_frame 70/90, state_panel_frame 80/60 (px at native size) -
  verify once against a live render and adjust.
Layout per art review 2026-11-16: bottom bar = left tab entries (square
buttons), center compass, right contextual command segment (only when a
stack is selected), far-right end-turn. Right panel header drops its tab row.
