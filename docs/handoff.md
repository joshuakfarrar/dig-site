# Handoff (2026-11-08)

Where Dig Site stands, for whichever session picks it up next. Everything below is committed to
`main`; there is no remote (ask the user before creating one; `gh` isn't installed).

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

## Design decisions the user made

- **Stack:** TS + Vite + three.js (they picked it); newest dependency versions.
- **Simple mechanics:** keep them exactly as simple as they are. Drive, one Work button, Hop; nothing to read, no timers, scores or fail states.
- **Safety first:** "SAFE FOR KIDS" is the top priority.
- **Grow the idea freely:** scaling up is open ("bigger houses, housing types, commercial buildings" are all welcome). More equipment is welcome too: loading and unloading trucks, clearing and cleaning up the site.
- **Look:** they and their wife love the voxel style. She doesn't play games and built the first house unaided.
- **Touch controls:** on hold. The user wanted to see the game with mouse and keyboard first.
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

- **Mixer at the pit edge:** it tips crudely and can clip the pit walls (settling is front/back height only).
- **Pushed heaps:** they move ahead of the blade and can pass into a wall, fence or machine for a moment before they vanish.
- **Ice-cream shop roof:** from the normal high camera the cone reads as a pink blob; it reads well from the low camera.
- **Peach cottage (lot 7):** its walls look brownish in shade; the colour may want lifting.
- **Lot spacing:** row-one lots' little models sit fairly far back from the road ring; it works, but they're a long way from where you stop.
- **Arrival pop:** starts on a `setTimeout(0)`. Harmless, but untidy.
- **Testing in a hidden tab:** the browser throttles requestAnimationFrame there. Use `game.advance(seconds, held)` (dev only) to step the game. Screenshots lag one frame, so advance about 0.02 s first.

## Uncommitted

Nothing. The working tree was clean after `f816ca8` plus this note.

## Dev aids

- `?lot=N` opens that lot's site; add `&stage=pour|walls|roof|path|clean|done` to start further in.
- In the console:
  - `game.advance(s, {moveX, moveY, work, workPressed, hopPressed, restart})` steps the game.
  - `game.goTown(lot)` and `game.goBuild(lot)` switch modes.
  - `game.town.look(...)` and `game.build.look(...)` move the camera (`look()` releases it).
