# Dig Site (working name)

A calm game for kids on a sunny construction site. You drive chunky voxel construction machines and
finish jobs that each add a part to a prefab house: dig the pit, pour the slab, lift the walls in,
then the roof. There's no gathering, no failing and no timer, and nothing to read: the next job is
shown in the scene, at the machine and at the spot.

It looks and drives like the vehicles in Kickstack: the same voxel builder (only the faces between a
cell and empty space, shaded by which way they face), 0.1-tile cells, and Kickstack's steering
(`VehicleOps.steer`): the machine goes where the stick points on screen, and stops to turn on the
spot when that's well off its nose.

## Run it

```bash
npm install
npm run dev     # http://localhost:5288
npm run build   # typecheck and bundle into dist/
```

TypeScript, Vite and three.js.

## Play

| | Keyboard | Gamepad |
|---|---|---|
| Drive | WASD or arrows | left stick or d-pad |
| Work (dig, lift, set down) | Space or Enter | A |
| Hop into the machine you're next to | E | Y or X |
| Start again (once it's built) | R | Start |

1. **Excavator** (yellow): drive onto an orange ring by the footprint and hold Work. Each scoop digs a
   bit of that quarter of the pit and tips the dirt onto a mound behind you. Two scoops per quarter,
   four quarters.
2. **Cement mixer** (blue): drive across the pit. Concrete pours from the chute at the back wherever
   it passes, so you paint the slab in. It sets once 90% is in.
3. **Crane** (red): drive up to the trailer and press Work to lift the top panel, then press Work
   beside its see-through outline to set it in. Four walls, then the roof from the pallet.

What guides a player who doesn't read:
- an orange arrow over the machine to use next, or the spot to go to;
- a pulsing ring on the ground at the spot, and a chevron by your machine pointing the way while the
  spot is off-screen;
- a picture of the button over your machine when it can work (a space bar, or a green A), and over a
  machine you can hop into (E, or a yellow Y);
- the progress strip at the top: the house's four parts as pictures, ticked off as they're done.

Each part ends with a moment: a pop of the new section, dust round its edge and a rising chime;
a fanfare, confetti and a flag for the roof.

## Code

- `src/voxel.ts`: the voxel model builder.
- `src/models.ts`: every model, machines in 0.1-tile cells.
- `src/machines.ts`: driving, collision, sitting on the ground, and each machine's animated job.
- `src/site.ts`: the site, the pit and slab as an 8 x 8 grid of half-tile columns, wall slots, props.
- `src/guide.ts`: the arrow, ring, chevron and button pictures.
- `src/fx.ts`, `src/audio.ts`: cube particles and synthesised sounds (no asset files).
- `src/main.ts`: the stages, hopping, the camera and the loop.

## Dev aids

- `?stage=pour|walls|roof|done` starts further on.
- In the console, `game.advance(seconds, {moveX, moveY, work, workPressed, hopPressed})` steps the game
  at 60 Hz with that input held (the browser throttles a hidden tab's frames), and
  `game.look(x, y, z, atX, atY, atZ)` holds the camera somewhere for a closer look (`game.look()` lets
  go).

See `docs/art.md` for how things should look.
