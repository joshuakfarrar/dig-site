# How things look

Borrowed from Kickstack's art rules (crate-buddies `docs/art.md`), with machine paint in place of
team colour.

## Legible first

- **From the game camera, at a glance:** which machine it is, which way it faces, what its moving
  part is doing, and which one you're driving (the amber beacon flashes on that one).
- **Each machine's paint is its big flat areas:** excavator yellow (0xf2b705), mixer blue (0x2f74d0),
  crane red (0xd8382c), roller green (0x2ea05a), bulldozer purple (0x8a5cd6), the town truck orange
  (0xff8a1f). Kids find "the yellow one" by colour, so keep the paint dominant from above, and give
  a new machine a colour no other one has.
- **White (0xf4f4f4) is trim:** one thin stripe down a side.
- **Working parts are neutral grey, not black:** Steel 0x7d8590, Gray 0x8a8f96, Dark 0x262626,
  Rubber 0x1d1d1d, Glass 0x9fd3ff.
- **Hazard yellow (0xf2c200) is an accent on the part that does the work:** the bucket's stripe, the
  chute, the hook block.

## Size

- **Cells:** machines and props 0.1 tile, the worker 1/20 tile. Never finer.
- **Footprint:** a machine's collision circles (`circles` in `machines.ts`) cover its body and, for the
  excavator, the bucket out front.

## Shape

- **Chunky first:** a solid body, corners rounded by clearing edge cells, tapers in steps.
- **Read from above:** the camera looks down at about 51 degrees; the silhouette is the top view.
- **Nothing one cell thin** except rams, cables and the exhaust.
- **Moving parts are their own models**, each turning about its own pivot: the excavator's house,
  boom, stick and bucket; the mixer's drum; the crane's top, boom sections and hook; the roller's drum.
- **Telescoping parts stay sleeved:** each section of the crane's boom keeps a good length inside
  the one before at full stretch, so there's never a gap.

## Buildings and the town

- **Pastel walls, white trim, one strong roof colour.** Panels are 14 cells high and 2 thick, with a
  grey plinth (a white band upstairs), white-framed windows with sills, and a door.
- **Each kind reads from above by its roof:** a gable for houses, a giant ice-cream cone for the shop,
  a bell tower for the fire station.
- **People are 1/20-tile cells,** like the worker: about 0.8 tall, children 0.6.

## Looking for what looks wrong

Every render is a hunt for what looks wrong: machines in the ground or floating, parts through each
other (an arm through another machine, a wall landing on a parked truck), a payoff off-screen, a
prompt that says something the picture doesn't show. Look from the game camera and from the side.
