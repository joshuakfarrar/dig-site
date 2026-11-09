# How things look

Borrowed from Kickstack's art rules (crate-buddies `docs/art.md`), with machine paint in place of
team colour.

## Legible first

- **From the game camera, at a glance:** which machine it is, which way it faces, what its moving
  part is doing, and which one you're driving (the amber beacon flashes on that one).
- **Each machine's paint is its big flat areas:** excavator yellow (0xf2b705), mixer blue (0x2f74d0),
  crane red (0xd8382c). Kids find "the yellow one" by colour, so keep the paint dominant from above.
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
  boom, stick and bucket; the mixer's drum; the crane's top, boom sections and hook.

## Looking for what looks wrong

Every render is a hunt for what looks wrong: machines in the ground or floating, parts through each
other (an arm through another machine, a wall landing on a parked truck), a payoff off-screen, a
prompt that says something the picture doesn't show. Look from the game camera and from the side.
