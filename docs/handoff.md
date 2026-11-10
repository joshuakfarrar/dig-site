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

## Phase 3, a living town

- **Traffic** (`town.ts`, `LOOP`, `updateCars`):
  - Two cars and the bus follow a lane loop round both streets and the side roads.
  - A car stops if the truck is within its lane just ahead (1.05 sideways, its length + 2.6 ahead) or another car is (0.9 sideways). It never reverses.
  - Car circles live in `ground.circles`, so the truck bumps into cars rather than through them.
  - The truck's home and the yard's load ring are by the west kerb, so traffic can pass them.
- **Evening** (`updateDusk`):
  - Once every lot is built (after the last party), the sky, fog, sun and hemisphere light ease to warm evening colours, and the lamp heads and soft light pools fade in.
  - It starts at full evening when you come back to a finished street.

## Phase 3, playground and music

- **Playground** (`B.playground`, Market Square lot 6):
  - The panels are `fence` styles (`playFence`), and the "roof" is `playSet` with `onGround: true`, so `roofAt` puts it on the slab.
  - `Blueprint.slab` gives the soft green surface; the site and `assemble` both use it.
  - In town, `residents(..., playground)` fills it with children.
- **Music** (`audio.ts`, `music()`, called every frame from `main.ts`):
  - A lookahead scheduler at 88 bpm going round C, Am, F, G: pad and bass, and a seeded marimba tune that changes every eight bars.
  - `duck()` lowers it for `fanfare` and `sectionDone`. It sits under the master mute.
  - Not yet heard by a person.
- **Engine:** triangle waves, a lower filter and less gain.

## Phase 3, title and forklift

- **Title** (`Hud.title`, `#title`): it shows over the town on a normal start, and is skipped for `?lot=` and `?hood=` dev links. The first press starts and is swallowed, so it doesn't drive the truck. That press also unlocks audio.
- **Forklift** (`town.ts`, `updateFork`): a scripted animation, not a `Machine`. Work at the pile hands the load to it, it carries the load to `bedWorld`, and `loaded` turns true at 1.05 s. It counts as `busy` while it runs.

Phase 3 is complete apart from the "about an hour of play" check, which needs a real playtest.

## Playtest fixes (2026-11-09)

- **Floors between storeys:** this has been replaced by storey modules; see "Trimming build time" below. `assemble` still includes the floors.
- **Carrying big loads:** `Crane.carryPose(load)` carries roofs and floors out behind the crane on a long boom and cable, side-on (`carryYaw` pi/2). Clearance comes from the load's `reach` and its `edge` height. The fire station roof (tower at its edge) and wall panels keep the old high carry.
- **Front walk:** `B.frontWalk` paves a walk from every door's ramp to the path, with flowers along it and pots beside each ramp. It's in `assemble`, and on site it appears with the ramps.
- **Residents are households** (`HOUSEHOLDS` in `town.ts`):
  - Mostly a mum, a dad and children; sometimes grandparents, a single parent, a couple, or a family with a grandma.
  - A household shares its skin and hair colour.
  - About 1 in 8 households has a wheelchair user or a headscarf; about half the homes have a dog.
  - Women and girls have long hair, and some wear dresses (`Look.long`, `Look.dress`).
  - Seeded per neighbourhood and lot.
- **Volume:** the sound button steps loud, medium, quiet, off; it's saved on the device and works on the title.

## Playtest fixes, round two (2026-11-09)

- **Cab roofs:** `cabRoof()` in `models.ts` draws a flat roof, with a rim in the paint round a white panel, on the cars, truck, dozer, dump truck and sweeper. The rounded white tops looked like eggs.
- **Dump truck on every site:**
  - The excavator loads it if its bed is about 2.6 from the excavator (within 0.8). It uses a raised dump pose (`dig(..., high)`), and each scoop adds half a heap.
  - `tipJob()` is offered whenever you drive the truck with a load, in any stage.
  - At the end, `finishJob` lets either the dozer or the truck clear heaps; `Blueprint.finish` only picks which one the arrow suggests.
  - The skip is always there. Homes: dozer (8.3, 5.8), dump (10.6, 5.8), sweeper (-7.7, 3.6).
- **Gardens** (`gardens()` in `town.ts`): hedges down the sides and along the back, plus two seeded items (tree, shed, washing line, veg patch, trampoline). They go in the back garden if it's deep enough, otherwise down the sides.
- **Countryside** (`buildCountryside`): a farm behind the first street (barn, three fields, tractor), patches of lighter and darker grass, and wildflower clusters. Trees are kept out of the farm.

## Playtest fixes, round three (2026-11-09)

- **Guided loading** (`loadJob` in `build.ts`) on hauling sites (`finish: "haul"`: Home Street, and the Harbour's odd lots):
  - The truck parks at `pairs[i].park`, centred 1.7 in front of or behind the pit.
  - The excavator digs that side's two quarters into it. `bedInReach` means the bed is 3.0 ± 1.05 from the excavator, and it uses the `Excavator.LOAD` pose.
  - When the truck's full, `tipJob`. When the pit's dug and the truck's empty, `digDone`. There's no heaps stage.
  - You start in the truck, and the progress strip shows a truck step after dig.
- **Push sites** (Market Square, the Harbour's even lots): heaps, then the dozer. No dump truck or skip.
- **Parking:** only the machines a site uses. Homes: excavator (-6.4, 5.4), mixer (-3.6, 6.4), roller (-1.4, 6.9), crane by the trailer (6.4, -4.2), dozer or dump (7.4, 5.6), sweeper (-8.6, 2.6).
- **Front walk:** one row of slabs on the path's half-tile grid, leaving out the path's own columns, so nothing overlaps and flickers. No pots.
- **Flowers:** `M.flowers` takes the seed modulo, so negative seeds no longer give black flowers.

## Stage order (2026-11-09)

The order is `dig, pour, clean, walls, roof, path, sweep, done`. The user wants the ground sorted first (dig, pour, clear the heaps) so heaps don't clutter the site while the crane works.
- Hauling sites go from pour straight to walls.
- `cleanDone` starts the walls; `pathDone` goes to sweep or done.
- `skipTo` works by stage name (`past()`).

## Pavements and planting (2026-11-09)

- **Pavements** (`walk()` in `town.ts`): half-tile paving slabs over a darker joint colour, a few a shade different, and a row of kerb stones along the road edge.
- **Planting** (`src/flora.ts`, `scatterFlora`): grass tufts, taller grasses, wildflower clumps, small bushes and rocks.
  - It's one mesh with no shadows, and avoids rectangles you give it.
  - The town uses 1,600 items, avoiding lots, roads, the yard, farm, gates and the park, square or sea. The site uses 700, outside its fence.
  - Count scales with quality: high 100%, medium 60%, low 35%.
- **Performance note for Phase 4:** a full Home Street view is about 490k triangles across 319 draw calls, about 580k of the scene's triangles cast shadows, and trees are around 12k triangles each. Greedy meshing in `Model.geometry` (merging flat runs of same-colour faces) would cut this a lot, so do it before testing on tablets.

## Hop anywhere, new dump truck (2026-11-09)

- **Hop goes to the machine the arrow wants** (`wanted` in the build tick), from any distance. The builder takes a longer, higher leap, and the Hop prompt shows over the machine you're in.
  - Before, after parking the truck you had to drive it next to the excavator to hop, which left the parking ring, so the arrow sent you back.
  - Next to some other machine, Hop still goes to that one.
- **Dump truck model:** chunkier, with six big wheels, mudguards, a short cab, a steel tipper with teal ribs, and a guard over the cab. Collision is a little wider (radius 0.7).

- **Camera:** near the building it holds back (the focus z stays at most 2.6), and further towards the gate it follows (`2.6 + (z - 4.2)`), so tipping at the skip is framed in the middle.
- **Off the pad before hopping:** if the machine you're in is on the building's pad and the arrow wants another, `padExit()` puts a ring just off the nearest edge. Hop is disabled until you drive there. This doesn't apply during digging.

## Trimming build time (2026-11-09)

Estimated at adult pace from distances, speeds and animation times, about 1 s of thinking per action. Children are probably 1.5 to 2 times slower.

| Building | Before | After | Change |
|---|---|---|---|
| Cottage | ~3.2 min | ~3 min | |
| Terrace | ~4.5 min | ~3.4 min | 5 lifts, was 9 |
| Flats / lighthouse | ~5.5–6 min | ~3.8–4.2 min | 6 lifts, was 14 |

- **Storey modules** (`buildModule` in `build.ts`):
  - Every storey above the ground floor is one lift: its floor deck plus its four wall panels, already joined, with the pivot at the middle of the floor's underside.
  - Modules wait stacked on `site.floorPalletAt`, first on top. They're carried behind the crane (`reach`, `edge: MODULE_H`) and set down facing front (identity).
  - Only the ground floor's four panels go on the trailer. `repaintWalls` rebuilds the modules too.
- **Crane:** pick-up takes about 1.5 s (was 2.05) and set-down about 1.55 s (was 2.1).
- **Sweeping:** six sand drifts, two of them on the path by the gate.

## Phase 4 started: Android (2026-11-09)

- **Greedy meshing** in `Model.geometry` (`voxel.ts`) merges same-colour, same-facing faces into rectangles. A full street went from about 491k drawn triangles to 80k, and shadow casters from 577k to 54k. It looks the same, and building the town takes about 0.7 s.
- **Capacitor 8 Android project** in `android/`, configured in `capacitor.config.ts`: app id `social.josh.digsite`, which isn't settled yet. See `docs/android.md`.
  - No internet permission, `sensorLandscape`, immersive full screen, and keep-screen-on (`MainActivity.java`).
  - The back button (`@capacitor/app` in `main.ts`) exits only from the title; in play it calls `Hud.flash()`.
- **Not done yet:** the Android SDK isn't on this PC, so no APK has been built. Install Android Studio first. The icon and splash are still defaults.

## Art review tools (2026-11-09)

- **`?lineup`** (dev server only, `src/lineup.ts`): every machine and vehicle side by side, plus people and a cottage for scale.
  - Left and right step between them, up and down zoom, Space toggles the turntable, and E switches between the game's camera and a low close-up.
  - From the console: `lineup.show(index, angle, closeUp, zoom)` holds one still for a screenshot.
  - Use it for the machine art pass. The rules are in `docs/art.md` ("One fleet").
- **Cement mixer remodelled:** it now has the dump truck's big wheels, mudguards and cab (shared `bigWheel` and `truckCab` in `models.ts`).
  - It also has a bigger pear-shaped drum with two spiral bands, tool boxes, a hopper and ladder, and a separate angled chute (`mixerChute`).
  - It's now 1.4 wide (collision radius 0.7, the same as the dump truck), and the chute tip has moved to (-1.75, 0.68). Pouring has been checked by driving across the pit.
- **Crane remodelled:** it has four axles of `bigWheel` with mudguards, a narrow cab with a flat roof front left, and the boom rest beside it.
  - The top has a lower housing (so the boom lies over it), a bigger striped counterweight and a flat-roofed operator's cab. The beacon is on that cab.
  - Collision is now radius 0.65 with halfLen 1.45. `top.position` and `BOOM_ROOT` are unchanged, so the lift geometry is the same.
  - Checked by lifting all of the cottage (walls and roof) and the flats (walls, both storey modules and the garden roof). The crane fits its parking spot on all 24 lots.
- **Excavator cab and roller canopy** now have the flat `cabRoof`. The farm tractor got a proper cab (green posts, glass, flat roof) and chunky wheels with yellow hubs.
- **People, light-touch variety** (`household` in `town.ts`, `Look` in `models.ts`):
  - **Skin:** parents' tones are close; about 8% of couples differ more. Children take after both.
  - **Hair:** each grown-up has their own, weighted to browns, then black, fair and red. Darker skin gets darker hair; grandparents are grey.
  - **Faces:** some dads are bald (15%) or bearded (25%), and grandpas more so. About 20% of mums have short hair.
  - **Clothes:** 20% of grown-ups wear an open jacket; some people have short sleeves, shorts or white trainers.
  - Shown on the lineup's people row.
- **Playtest fixes:**
  - A wall, floor or roof's white ghost now hides while the real one is lowered into it, so they no longer flicker through each other.
  - The marking-out strings come up with a dust puff at the first bite; the excavator's body used to swing through them, flashing white.
  - The finished-town ring and arrow are now under the arch, where driving in takes you on. Before, the ring was in front of the arch, so stopping in it did nothing, and the arrow pointed at the landmark on top.
- **Playground in use** (`PLAY`, `playRoute` and `playStep` in `town.ts`):
  - When you drive to a playground that's already built, everyone is already playing. When it's just been built, they run in through the gate.
  - Children swing, go down the slide two or three times in a row, ride the roundabout or dig in the sandpit; grown-ups sit on the bench or stand watching. Children are on the equipment about 70% of the time.
  - One child per swing, one on the slide at a time, and one grown-up at each end of the bench.
  - **The swings and roundabout move.** In town the play set is built `bare` (`M.playSet(w, d, true)`), and the swings and roundabout disc are added as separate pieces (`M.playSwing`, `M.playRoundabout`, placed by `M.playParts`). `updatePlay` moves them:
    - A ridden swing works up to about 24 degrees and settles before the child gets off; an empty one swings on a little and comes to rest.
    - The roundabout gets going when someone's on it and slows to a stop when they're not. Riders sit between the handlebars and go round with it.
  - The crane still lifts in the whole play set as one piece.
  - It has no picket fence, mailbox, hedges, trees or garden things (its rainbow fence is the fence). Trees either side looked crowded next to the neighbours' garden trees.
- **One hedge between neighbouring gardens**, on the boundary, planted by whichever lot is built first. Before, each lot planted its own, so there were two rows.
- **No garden sheds:** squeezed in beside a house they read as an odd box. `M.shed` has been removed.
- **Dev helpers:** `game.build` now exposes `wallLoads`, `moduleLoads`, `roofLoad` and `wallsUp`, for driving the crane from the console.
- **Town yard:**
  - Packed gravel with a concrete edge, white parking bays and tyre tracks.
  - The crew's cabin and a green tool container at the back, plus pipe stacks, brick pallets and cones.
  - `YARD` in `town.ts` sets its size; the trees and flora keep clear of it.
- **Fix:** `.corner[hidden]` really hides now; `display: grid` was overriding `hidden`.

## Free tier, parent gate, icon (2026-11-09)

- **`src/shop.ts`:**
  - `FREE_LOTS` is 2, counted across every neighbourhood.
  - `locked(builtSoFar)` asks `paywallOn()` (off unless `VITE_PAYWALL=on`, or `?paywall` in dev) and `owned()` (kept on the device under `dig-site/unlocked/v1`).
  - `price`, `buy` and `restore` are stubs: dev unlocks, a release build says the store isn't available. Fill them in with the billing plugins.
- **In town while locked:**
  - Padlocks bob over the materials pile and every empty lot. The arrow, load ring and lot rings are hidden.
  - Work at the pile jiggles its padlock (`Audio.pop`) and bobs the grown-ups' button, through `TownHooks.locked` and `askGrownUp`.
- **`src/grownups.ts`:**
  - The `#grown` corner button (top left, town only, only while locked) opens the parent gate: a sum in words (answers 11 to 18) on a number pad. A miss gives a new sum, and three misses close it.
  - Then the unlock card. On a purchase: a fanfare, and the padlocks go on the next frame.
  - The game's controls are ignored while it's up, and Android's back button closes it.
- **Icon and splash:** `tools/make_icons.py`; see `docs/android.md`.
- **Dev:** `game.shop.forget()` un-owns it again; `game.shop.owned()` checks it.

## Empty lots dressed (2026-11-09)

- **`emptyLot` in `town.ts`:** each empty lot looks like a site waiting to start.
  - **Ground:** sand with darker patches and grit, and wheel ruts in from the road.
  - **Outline:** the house's outline pegged and strung, with no string across the stand.
  - **Props:** bricks and planks at the back, a wheelbarrow, and two cones.
  - **New models:** `M.wheelbarrow` and `M.planks`.
- **Kept clear:** the stand, the way in, and where the truck drops its load.
- **Ground layers** are each a little higher than the last, so they never flicker from far off.

## Promo video (2026-11-09)

- **A 42-second story:** an empty street, then digging, pouring and the roof lowered on, a family moving in, neighbours, the playground, and the Harbour at dusk. It ends on a card with the icon and "Build a town, one home at a time".
- **To remake it:**
  1. Open `?promo&quality=high` on the dev server.
  2. In the console, run `promo.music(44)`, then `promo.film()`.
  3. Run `python tools/make_promo.py`.
  4. It writes `capture/dig-site-promo.mp4` (1080p) and `capture/dig-site-promo-720p.mp4`. `capture/` isn't in git.
- **`src/promo.ts`** (dev only) scripts each shot: its set-up, a camera path, and the controls held. `promo.proof(name, t)` saves one frame to check.
- **Frames reach disk** through a dev-server-only endpoint (`capture()` in `vite.config.ts`).
- **Needs** Pillow and `imageio-ffmpeg`, which brings its own ffmpeg.
- **Words:** the captions and the card are drawn in `tools/make_promo.py` (Segoe UI); change the story there and in the shot list.
- **The reel** (vertical 9:16, 26.5 s, for phones):
  - Run `promo.film("reel")`, then `python tools/make_reel.py`. It writes `capture/dig-site-reel.mp4`.
  - **Cut to the beat:** a 120 bpm tune made in the script (numpy), a beat every 15 frames. Big sticker words pop in on the beat, and every cut lands on one.
  - **Running order:**
    1. Close-ups: DIG!, POUR!, BUILD!, WELCOME HOME!
    2. The street filling up one house a beat, each with a rising chime, as the player's truck drives down it.
    3. The playground.
    4. "No ads", "No timers", "No reading needed", "Just build".
    5. The end card.
  - **House pops:** they wait 0.45 s after arriving (`POP_LEAD` in `promo.ts` pre-rolls it), so they land on the beat.

## Design decisions the user made
- **Diversity includes ordinary families:** the user wants a mix that reads as real streets, mostly cis/het families with children, plus the other kinds of households, not an unusual mix everywhere.

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
