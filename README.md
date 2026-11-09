# Dig Site (working name)

A calm game for kids about building a town. You drive chunky voxel machines and finish jobs that
each add a part to a building: dig the pit, pour the slab, lift the walls in, lift on the roof, roll
the path and push the dirt heaps away. Then the building pops up on its street, with a garden, and
its people come out and wave. There's no gathering, no failing and no timer, and nothing to read:
the next job is always shown in the scene, at the machine and at the spot.

It looks and drives like the vehicles in Kickstack: the same voxel builder (only the faces between a
cell and empty space, shaded by which way they face), 0.1-tile cells, and Kickstack's steering
(`VehicleOps.steer`): the machine goes where the stick points on screen, and stops to turn on the
spot when that's well off its nose.

## Run it

```bash
npm install
npm run dev       # http://localhost:5288
npm run build     # typecheck and bundle into dist/
npm run preview   # the built game, http://localhost:5289
```

TypeScript, Vite and three.js.

## Play

| | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Drive | WASD or arrows | left stick or d-pad | drag on the left half of the screen |
| Work (load, unload, dig, lift, set down) | Space or Enter | A | the orange gear button, or a tap on the right half |
| Hop into the machine you're next to | E | Y or X | the blue hop button (shown only when there's a machine to hop into) |
| Back to town / new town (hold) | hold R, or hold the corner button | hold Start | hold the corner button |

The prompts in the scene show whichever was used last. On a touch screen held upright, a picture
asks for it to be turned on its side. Graphics quality starts from a guess about the device and
steps down if frames run slow (`?quality=high|medium|low` forces one). In the background the game
pauses and goes quiet.

### The town

The town has neighbourhoods. You start in **Home Street**, which has a park with a pond. Build
all eight lots there and the barrier on the gate at the east end of the top street lifts, with a
fanfare. Drive through it to reach **Market Square**: a school, café, library, police station, a
town hall with a clock tower, and more homes, around a square with a fountain and market stalls.
Finish Market Square and its gate opens onto **the Harbour**: a fish shop, a boathouse, an
aquarium with a whale on the roof, seaside homes, and a lighthouse the crane builds floor by
floor, by a beach with umbrellas, beach huts, a pier and boats bobbing on the sea. Each gate has
a little model on top of a building from the neighbourhood it leads to, and the bottom street's
gate goes back.

Before the crane lifts a home's walls, four pictures pop up: the home's own colours and three
other paint sets (a terrace or duplex gets a colour for each home). Before a pitched roof goes on,
four roof colours do the same. Move left and right and press Work, or tap or click one. The
panels on the trailer repaint with confetti, and the finished home stays in those colours in town.

Two cars and a little yellow bus drive round the streets. They always stop and wait if the truck
is in the way, and pass it when it's pulled in at the kerb. Once a street is finished, the light
turns to a warm golden evening and the street lamps come on.

Market Square has a playground too: a soft green surface, a rainbow fence with a way in, and a
play set the crane lifts in all at once (a slide tower, swings, a roundabout, a sandpit). In town
it fills up with children.

A gentle tune plays underneath: a soft marimba over a warm pad, made in code like every other
sound, that wanders a little differently every eight bars and dips when a fanfare plays.

The sound button in the corner steps through loud, medium, quiet and off (its waves show which),
and it remembers the choice on this device. It works on the title screen too.

The game opens on a picture and one big round Play button over the town. Any key, the pad's A
button or a tap starts it. In the yard, a little lime forklift loads the truck for you.

On Home Street, and on half the Harbour's lots, the dirt goes straight into the teal dump
truck. You start in the truck, and the arrow shows where to park it in front of the pit. Hop into
the excavator and dig the two quarters on that side: each bucketful swings over into the truck.
When it's full, drive it to the skip by the gate and tip it. Then park it behind the pit for the
other two quarters, and tip again. That's two loads, and no heaps to clear afterwards. In Market
Square and on the rest of the Harbour, the dirt goes in heaps, and once the slab's poured the
bulldozer pushes them away before any building starts. Either way the ground's sorted first
(dig, pour, clear up) so the site's clear for the crane. Each site only parks the machines it uses, and the crane waits by its trailer.

The town has gardens: hedges between and behind them, and trees, sheds, washing lines,
vegetable patches and trampolines out the back. Behind the first street there's a little farm,
with a red barn, fields and a tractor, and wildflowers in the grass. On the Harbour, sand
blows in from the beach at the end, and the pink street sweeper sweeps it up. Each neighbourhood's progress is saved on its own.

You drive the crew's orange truck round two streets. Eight empty lots each show a little model of
what goes there, turning on a stand: a cottage, a two-storey house, a duplex, a row of three
terraced homes, a three-storey block of flats with balconies and a roof garden, flats over a
bakery, an ice-cream shop and a fire station. Every front door gets a step-free ramp, with a paved walk
joining the ramps to the path and pots of flowers beside them. The people who move in are
households: mostly a mum and dad with their children, and also grandparents, single parents,
couples and grandparents living with the family. Now and then someone uses a wheelchair or
wears a headscarf, and about half the homes have a dog.

1. Stop in the ring by the yard's pile and press Work: a pallet and a crate hop into the truck.
2. Drive to any empty lot's ring and press Work: they hop off onto the lot, and its site opens.
3. When the building's done you come back to it standing in the town, with confetti.

The progress strip shows the town's eight houses, filled in as they're built. The town's kept in this
browser between visits.

### A building site

1. **Excavator** (yellow): drive onto an orange ring by the footprint and hold Work. Each scoop digs a
   bit of that quarter of the pit and tips the dirt onto a heap behind you.
2. **Cement mixer** (blue): drive across the pit. Concrete pours from the chute wherever it passes,
   so you paint the slab in.
3. **Crane** (red): drive up to the trailer and press Work to lift the top panel, then press Work
   beside its see-through outline to set it in. A storey of walls at a time, then the roof from the
   pallet. Its boom telescopes in three sections.
4. **Road roller** (green): drive up and down the dirt track to the gate to pave it.
5. **Bulldozer** (purple): drive into each dirt heap and push it away.

What guides a player who doesn't read:
- an orange arrow over the machine to use next, or the spot to go to;
- a pulsing ring on the ground at the spot, and a chevron by your machine pointing the way while the
  spot is off-screen;
- a picture of the button over your machine when it can work (a space bar, or a green A), and over a
  machine you can hop into (E, or a yellow Y);
- the progress strip at the top: each job as a picture, ticked off as it's done.

## Made for kids

- **Nothing goes online.** No accounts, ads, analytics, chat, links out or purchases. The built page
  carries a Content Security Policy (`vite.config.ts`) that allows only the game's own files and
  blocks every network connection. Sounds are synthesised and models are built in code, so there are
  no fetched assets.
- **The only thing kept is the town,** in this browser's local storage (`src/save.ts`): which lots are
  built. Nothing personal.
- **Nothing undoes a child's work by accident.** Leaving a site or starting a new town means holding
  the corner button (or R / Start) while a ring fills: 1.2 s to leave a site, 2.4 s for a new town.
  After one goes off, it has to be let go before it can go off again.
- **No failing, no timers, no scores, no reading.**
- **Gentle by design.** No crashes or damage. People only walk in their gardens and on the pavement;
  the truck only drives on the road, so they never meet. Flashing is slow (the beacon is about
  1.4 Hz), and the sound is soft, with a mute button.

## Code

- `src/main.ts`: the renderer, the loop, switching between the town and a site.
- `src/town.ts`: the town, the truck, loading and unloading, lots, gardens and people.
- `src/build.ts`: a building site's jobs, hopping between machines, the camera.
- `src/blueprints.ts`: what can be built, as data (footprint, storeys, wall panels, roof) and the town's lots.
- `src/site.ts`: the site, the pit and slab as a grid of half-tile columns, the path, props.
- `src/machines.ts`: driving, collision, sitting on the ground, and each machine's animated job.
- `src/models.ts`: every model, machines in 0.1-tile cells.
- `src/voxel.ts`: the voxel model builder.
- `src/guide.ts`: the arrow, ring, chevron and button pictures.
- `src/hud.ts`: the progress strip, the hold-to-confirm button and the fade.
- `src/fx.ts`, `src/audio.ts`: cube particles and synthesised sounds.
- `src/stage.ts`, `src/save.ts`, `src/input.ts`: scene lighting, the saved town, keyboard and pad.

## Dev aids (dev server only)

- `?lot=3` goes straight to that lot's site; `&stage=pour|walls|roof|path|clean|done` starts further in.
- In the console, `game.advance(seconds, {moveX, moveY, work, workPressed, hopPressed, restart})` steps
  the game at 60 Hz with that input held (the browser throttles a hidden tab's frames);
  `game.town.look(...)` / `game.build.look(x, y, z, atX, atY, atZ)` hold the camera somewhere
  (`look()` lets go); `game.goTown(lot)` and `game.goBuild(lot)` switch.

See `docs/art.md` for how things should look.
