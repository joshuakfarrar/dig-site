# Handoff (2026-11-08)

Where Dig Site stands, for whichever session picks it up next. Everything below is committed to
`main`; there is no remote (ask the user before creating one; `gh` isn't installed).

**Where it's going:** [roadmap.md](roadmap.md) lays out the plan to ship on Google Play, the App Store and Amazon as a free-to-try game with a single $2.99 unlock. Work through it phase by phase.

## Done

- **First slice** (`af3e9e4`): one site, where you dig the pit, pour the slab, and lift walls and roof with the crane.
  Keyboard and gamepad, hop between machines, no reading, no fail state, no timer.
- **Town version** (`f816ca8`):
  - **Town mode** (`src/town.ts`):
    - Drive the orange crew truck round two streets with 8 lots.
    - Load at the yard's pile (stop in the ring there and press Work), then unload at any empty lot's ring, which opens its site.
    - Built lots get a lawn, a paved path, a picket fence, flowers, a mailbox, bushes and 2–3 people. The people wander the garden and pavement and jump and wave when the truck passes.
    - When you come back from a site there's a low camera, confetti, and the building pops up. When all 8 are built there's a town-wide fanfare.
    - Saved in localStorage (`src/save.ts`).
  - **Blueprints** (`src/blueprints.ts`): cottage, two-storey house, ice-cream shop (giant cone on a flat roof, striped awning), fire station (roller garage door, bell tower), plus colour variants. A new building is mostly a data entry.
  - **Site jobs** (`src/build.ts`), each shown in the progress strip:
    1. dig
    2. pour
    3. walls, one strip step per storey
    4. roof
    5. path: the road roller paves it by driving over it
    6. clean: the bulldozer pushes the dirt heaps away
  - **Crane boom fix:**
    - The boom used to slide out past the end of its own model.
    - It now telescopes in three nested sections (`BOOM_SECTION`, `MAX_EXT` in `src/machines.ts`), each keeping 0.35 tile inside its sleeve.
    - `aimAt` takes a minimum tip height, so it can reach tall buildings.
    - The carry pose is higher, so the roof clears the cab.
  - **Pacing and looks:** digging and crane steps are about 30% quicker; the mixer drum is smaller with one wide band.
  - **Kid safety:**
    - A CSP in `vite.config.ts`, applied to the build only, blocks all network access. Verified: a fetch is refused, and the game runs clean under it.
    - Hold-to-confirm corner button (`src/hud.ts`): 1.2 s to leave a site, 2.4 s for a new town. It has to be released before it can fire again.
    - Dev hooks (`window.game`) exist only on the dev server.
    - People and the truck can never meet: the truck is boxed onto the roads.
  - README "Made for kids" section; `docs/art.md` updated with the new machine colours and building rules.

## Phase 1 of the roadmap (in progress)

- **Touch controls** (`src/touch.ts`): a floating stick on the left half; an orange gear Work button on the right that glows when it'd do something (any right-half tap counts); a blue Hop button that only appears next to a machine.
- **Prompts:** in-scene prompts use the same pictures whenever touch was used last (`Controls` in `guide.ts`, `Input.controls()`, `Input.hints()`).
- **Screen layout:**
  - Safe-area insets are respected.
  - Short sideways phones get smaller strip and corner buttons and a closer camera (`setViewZoom`).
  - An upright touch screen shows a turn-it-sideways picture.
- **Quality tiers** (`src/quality.ts`): high, medium or low, set by pixel ratio, shadow size and antialiasing. It starts from a guess about the device, steps down when frames are slow, and is remembered on the device.
- **Pause:** the game stops and goes quiet when the page is hidden.
- **Camera:** the view's middle is nudged below the progress strip (`fitCamera`), and the site camera's southern limit is 2.6, so the building no longer sits under the strip.
- **Not yet done from Phase 1:** testing on real devices (a cheap Android tablet and an iPad).

## Phase 3, homes for everyone (done)

- **Panels** (`M.wallPanel`) support several front doors (`doors`), a colour per home (`bands`) and upstairs `balconies`.
- **New blueprints:** `duplex`, `terrace`, `flats` (three storeys, roof garden, `hang: 1.0` so the crane can reach) and `corner` (bakery with flats over it). They're on lots 2, 4, 5 and 6, replacing three colour variants.
- **Ramps:** `B.ramps(bp)` puts a step-free ramp with handrails at every front door. In town it's part of the building; on site it pops in when the path is done.
- **Crane:** `BOOM_SECTION` is 24, and `Crane.canReachOver` gates Work, so the crane only lifts once it can carry the load down from above. A third storey or a tall roof means driving closer; the arrow keeps pointing until it can.
- **Residents** (`residents()` in `town.ts`): more people the more homes a building has, mixed across adults, children, older people with sticks, wheelchair users (who wave with a wheelie) and dogs. Some wear headscarves.

## Phase 3, neighbourhoods (Market Square done)

- **Data:** `B.HOODS` lists the neighbourhoods. Each has a theme (`park` or `square`), eight lots, and a landmark that its gate sign shows.
- **Save** (`town/v2`): built lots for each neighbourhood, plus the one you were last in. Old v1 saves become Home Street.
- **Gates:** `makeGate` in `town.ts`. The gate to the next neighbourhood is at the east end of road A and opens after the last lot's party. The way back is at the east end of road B. A street without a gate stops at the side road.
- **Market Square:**
  - Blueprints: `school`, `cafe`, `library` (with `columns`), `police`, `townHall` (clock tower at the east end of the roof, so the crane's slings miss it).
  - Models: `cupola`, `coffeeCup`, `openBook`, `lightBar`, `clockTower`.
  - Town: `buildSquare` draws the fountain, stalls and planters.
- **Ramps:** double doors share one wide ramp.
- **Dev:** `?hood=1` starts in Market Square; `game.goHood(h)` switches.
- **The Harbour** (hood 2):
  - Blueprints: `lighthouse` (3x3, three storeys, `lantern` top), `fishShop` (`bigFish`), `boathouse` (`garagePaint` boat door), `aquarium` (`whale`), plus seaside homes.
  - Town: `buildHarbour` draws the promenade, beach, sea, pier and bobbing boats; per-frame movement goes in the `anims` list.

## Phase 3, new machines

- **Finishing jobs:** `Blueprint.finish` is `"push"` (dozer) or `"haul"` (dump truck), and `Blueprint.sweep` adds a `sweep` stage. `B.HOODS` sets them: Home Street pushes, Market Square hauls, and the Harbour alternates between the two, with sweeping on every lot. Only the machines a site needs are parked there.
- **Stages:** `STAGES` now has `sweep` before `done`, so `?stage=done` is index 7.
- **Dump truck** (`DumpTruck`):
  - Load: stop within about 2.3 of a heap and press Work; the heap sinks into the bed. It carries two heaps.
  - Tip: at `TIP_AT` beside the skip (`SKIP_AT`, by the gate), Work turns it on the spot to back up to the skip, then tips.
- **Street sweeper** (`Sweeper`): `blowSand()` drops nine pale drifts, in front of the building and on the path by the gate, clear of the parking row. Brushes moving over a drift sweep it.

## Phase 3, picking colours

- **Choices:** `B.WALL_PALETTES` (three sets of three colours) and `B.ROOF_CHOICES`. `B.recolour(bp, [walls, roof])` maps the building's own paints (`paintsOf`, main colour first) onto the picked set.
- **Who gets them:** homes only (`canPickWalls`), and roof choices only for homes with gable roofs (`canPickRoof`).
- **Picker** (`Hud.choose`, `#picker`): big SVG swatches. Left and right move, Work picks, tap or click picks. A ticket stops one site from closing another's picker. While it's up, the machines get no input, and there's a 0.5 s wait before Work counts.
- **On site:** `pickWalls()` runs when the walls stage starts, `pickRoof()` when the roof stage starts. They repaint the trailer panels and ghosts, or the roof and its ghost.
- **Saving:** `Save.Town.looks["hood:lot"] = [walls, roof]`, saved only when something other than the default was picked. The town draws built lots with `B.recolour`.

## Design decisions the user made

- **Stack:** TS + Vite + three.js (they picked it); newest dependency versions.
- **Simple mechanics:** keep them exactly as simple as they are. Drive, one Work button, Hop; nothing to read, no timers, scores or fail states.
- **Safety first:** "SAFE FOR KIDS" is the top priority.
- **Grow the idea freely:** scaling up is open ("bigger houses, housing types, commercial buildings" are all welcome). More equipment is welcome too: loading and unloading trucks, clearing and cleaning up the site.
- **Look:** they and their wife love the voxel style. She doesn't play games and built the first house unaided.
- **Touch controls:** added in Phase 1, after the user had played with mouse and keyboard.
- **Inclusive housing:** the user wants multi-unit homes (duplexes, terraces, a small apartment block, flats over shops) and households of all kinds, for housing inclusivity. It's in Phase 3 of the roadmap.
- **Ports:** use our own ports (dev 5288, preview 5289), never 8080, 5173 or 5191.

## Still open / ideas

- **Touch controls** (on hold): an on-screen stick plus Work and Hop buttons, for tablets and phones.
- **Playtesting:** nobody has played this version in real time yet. Speeds and turn rates, the sounds, and whether a young child follows the town's load-then-deliver step all need a real player.
- **More building kinds:** a café, school, playground or park. Each is a blueprint plus a roof model, and maybe a new panel style.
- **More life in town:** cars on the roads (they must stop for the truck, never collide), lights at dusk, a second town or neighbourhood after all 8.
- **Light choice:** pick wall or roof colours by picture before the crane lifts them (no text).
- **Possible new machines that fit the controls:**
  - a dump truck the excavator loads (drive to a ring, press Work);
  - a forklift in the yard;
  - a street sweeper (drive over to clean).
- **Bundle size:** 650 kB, all three.js. Fine for now; it could be code-split.

## Known glitches

Fixed on 2026-11-08 (after `218c5dd`):
- **Mixer at the pit edge:** once the pit's dug, a gravel bed fills it to -0.14 and wet concrete pours level with the ground until the slab sets, so the steps are kerb-sized. The mixer tilts about 4° at the edge, down from 15°.
- **Pushed heaps:** a heap only moves if its new spot is clear of walls, the fence, props and the other machines. When it's blocked it stays put and flattens out faster.
- **Ice-cream cone:** the cone is taller, flares out as wide as the first scoop, and has a criss-cross waffle and drips (roof height is 2.9).
- **Peach cottage (lot 7):** the peach is pinker (0xffb4a0) and the roof is slate blue, so it no longer reads as brown in shade.
- **Lot models:** they now stand just inside the front fence near the road ring, and deliveries land beside the model.
- **Timers:** the arrival pop and the switch to a building site run off the town's tick clock, not `setTimeout`.

Still open:
- **Testing in a hidden tab:** the browser throttles requestAnimationFrame there. Use `game.advance(seconds, held)` (dev only) to step the game. Screenshots lag a frame or two, so advance about 0.05 s and wait a second before taking one.

## Uncommitted

Nothing.

## Dev aids

- `?lot=N` opens that lot's site; add `&stage=pour|walls|roof|path|clean|done` to start further in.
- In the console:
  - `game.advance(s, {moveX, moveY, work, workPressed, hopPressed, restart})` steps the game.
  - `game.goTown(lot)` and `game.goBuild(lot)` switch modes.
  - `game.town.look(...)` and `game.build.look(...)` move the camera (`look()` releases it).
