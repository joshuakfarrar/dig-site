import { Model } from "./voxel";

/**
 * The voxel models. Machines use tenth-of-a-tile cells, like Kickstack's vehicles (docs/art.md);
 * the worker uses 1/20-tile cells so they fit beside a cab. Everything faces +x.
 */
export const Cell = 0.1;
export const WorkerCell = 1 / 20;

export const C = {
  White: 0xf4f4f4,
  Black: 0x161616,
  Steel: 0x7d8590,
  Gray: 0x8a8f96,
  Dark: 0x262626,
  Rubber: 0x1d1d1d,
  Glass: 0x9fd3ff,
  Light: 0xfff3a0,
  Hazard: 0xf2c200,
  // Each machine's paint: the big flat areas, so you know it at a glance from above.
  Digger: 0xf2b705,
  Mixer: 0x2f74d0,
  Crane: 0xd8382c,
  // The ground.
  Sand: 0xd9b47c,
  Earth: 0x9a6b3f,
  Gravel: 0xa08766,
  Grass: 0x7ec850,
  WetConcrete: 0x8a929a,
  Concrete: 0xc9cbcc,
  Wood: 0x9a6a3c,
};

/** Clears the corners of a box's top edge, rounding it off (art: chunky, corners cleared). */
function bevelTop(m: Model, x0: number, y: number, z0: number, w: number, d: number): Model {
  for (const x of [x0, x0 + w - 1]) for (const z of [z0, z0 + d - 1]) m.clear(x, y, z, 1, 1, 1);
  return m;
}

// ---------------------------------------------------------------- excavator (yellow)

/** Tracks and frame: about 1.8 long and 1.4 wide, 0.3 high. The house sits on top and turns. */
export function excavatorTracks(): Model {
  const m = new Model();
  for (const z0 of [-7, 3]) {
    m.box(-9, 0, z0, 18, 3, 4, C.Rubber);
    // Rounded track ends.
    m.clear(-9, 0, z0, 1, 1, 4).clear(-9, 2, z0, 1, 1, 4).clear(8, 0, z0, 1, 1, 4).clear(8, 2, z0, 1, 1, 4);
    // Rollers on the outside face, grey so the tracks read as tracks.
    const outer = z0 < 0 ? z0 : z0 + 3;
    for (let x = -6; x <= 4; x += 5) m.box(x, 1, outer, 2, 1, 1, C.Steel);
    m.box(-8, 1, outer, 1, 1, 1, C.Gray).box(7, 1, outer, 1, 1, 1, C.Gray);
  }
  m.box(-5, 1, -3, 10, 2, 6, C.Dark); // frame between the tracks
  return m;
}

/** The house: deck, cab on the left, engine and counterweight behind. Pivot at its slew ring. */
export function excavatorHouse(): Model {
  const P = C.Digger;
  const m = new Model();
  m.box(-3, 0, -3, 6, 1, 6, C.Dark); // slew ring: a dark seam so the turning reads
  m.box(-8, 1, -6, 14, 4, 12, P); // deck
  bevelTop(m, -8, 4, -6, 14, 12);
  m.box(-9, 1, -5, 1, 3, 10, C.Steel); // counterweight
  m.box(-7, 3, -6, 6, 1, 1, C.White).box(-7, 3, 5, 6, 1, 1, C.White); // one stripe down each side
  // Cab, front left.
  m.box(0, 5, -6, 5, 6, 4, P);
  m.box(4, 6, -5, 1, 3, 2, C.Glass); // windscreen
  m.box(1, 6, -6, 3, 3, 1, C.Glass); // left window
  m.box(1, 6, -3, 3, 3, 1, C.Glass); // right window, looking at the arm
  m.clear(4, 10, -6, 1, 1, 1).clear(4, 10, -3, 1, 1, 1).clear(0, 10, -6, 1, 1, 1).clear(0, 10, -3, 1, 1, 1);
  // Engine hood behind, on the right, with a stubby exhaust.
  m.box(-8, 5, 0, 6, 2, 6, P);
  m.box(-8, 6, 1, 6, 1, 4, C.Gray).box(-7, 6, 2, 4, 1, 2, C.Dark); // grille on top
  m.box(-3, 7, 4, 1, 2, 1, C.Dark);
  // Where the boom hangs from: a steel lug on the front.
  m.box(5, 2, -1, 2, 3, 3, C.Steel);
  return m;
}

/** Boom: from its root (pivot at cell 0) out 15 cells along +x. Turns about z. */
export function excavatorBoom(): Model {
  const P = C.Digger;
  const m = new Model();
  m.box(0, -1, -1, 16, 3, 3, P);
  m.box(4, 2, -1, 7, 1, 3, P); // the hump of a bent boom
  m.clear(15, 1, -1, 1, 1, 3).clear(0, 1, -1, 1, 1, 3);
  m.box(2, -2, 0, 9, 1, 1, C.Steel); // ram underneath
  m.box(14, -1, -1, 2, 3, 3, C.Steel); // knuckle
  return m;
}

/** Stick: from the boom's tip, 12 cells along +x. */
export function excavatorStick(): Model {
  const m = new Model();
  m.box(0, -1, -1, 12, 2, 3, C.Digger);
  m.box(-1, 0, 0, 2, 2, 1, C.Steel); // ram mount
  m.box(10, -1, -1, 2, 2, 3, C.Steel);
  return m;
}

/** Bucket, opening toward -y when the stick points down: back plate, floor, sides, teeth. */
export function excavatorBucket(): Model {
  const m = new Model();
  m.box(0, -1, -2, 2, 2, 5, C.Dark); // hinge
  m.box(1, -5, -2, 1, 5, 5, C.Dark); // back
  m.box(-3, -5, -2, 4, 1, 5, C.Dark); // floor
  m.box(-3, -4, -2, 3, 3, 1, C.Dark).box(-3, -4, 2, 3, 3, 1, C.Dark); // sides
  m.box(-4, -5, -2, 1, 1, 5, C.Steel); // teeth
  m.box(1, -3, -2, 1, 1, 5, C.Hazard); // hazard stripe on the part that does the work
  return m;
}

/** A bucketful of dirt, sitting in the bucket. */
export function bucketDirt(): Model {
  return new Model().box(-3, -4, -1, 4, 2, 3, C.Earth).box(-2, -2, -1, 2, 1, 3, C.Earth);
}

// ---------------------------------------------------------------- cement mixer (blue)

export function mixerBody(): Model {
  const P = C.Mixer;
  const m = new Model();
  m.box(-12, 2, -4, 22, 2, 8, C.Dark); // chassis
  // Wheels: one axle under the cab, two at the back.
  for (const x0 of [5, -6, -10]) {
    m.box(x0, 0, -5, 3, 4, 1, C.Rubber).box(x0, 0, 4, 3, 4, 1, C.Rubber);
    m.box(x0, 0, -4, 3, 1, 8, C.Rubber);
    m.set(x0 + 1, 1, -5, C.Gray).set(x0 + 1, 1, 4, C.Gray);
  }
  // Cab.
  m.box(4, 4, -4, 6, 5, 8, P);
  m.box(4, 9, -4, 5, 1, 8, P);
  m.clear(9, 8, -4, 1, 1, 8);
  bevelTop(m, 4, 9, -4, 5, 8);
  m.box(9, 6, -3, 1, 2, 6, C.Glass);
  m.box(5, 6, -4, 3, 2, 1, C.Glass).box(5, 6, 3, 3, 2, 1, C.Glass);
  m.box(4, 5, -4, 5, 1, 1, C.White).box(4, 5, 3, 5, 1, 1, C.White);
  m.box(10, 2, -4, 1, 2, 8, C.Steel); // bumper
  m.set(10, 3, -4, C.Light).set(10, 3, 3, C.Light);
  m.box(9, 4, -2, 1, 1, 4, C.Gray); // grille
  // Drum stands: a low pedestal at the front, a tall one at the back.
  m.box(1, 4, -2, 2, 2, 4, C.Steel);
  m.box(-10, 4, -2, 2, 5, 4, C.Steel);
  m.box(-12, 4, -4, 2, 1, 8, P); // rear deck
  // Hopper over the drum's mouth.
  m.box(-12, 9, -2, 2, 2, 4, C.Steel).clear(-12, 10, -1, 2, 1, 2);
  // Chute: hazard yellow, stepping down and back from under the mouth.
  m.box(-13, 7, -1, 2, 1, 3, C.Hazard);
  m.box(-15, 6, -1, 2, 1, 3, C.Hazard);
  m.box(-15, 7, -1, 2, 1, 1, C.Hazard).box(-15, 7, 1, 2, 1, 1, C.Hazard);
  return m;
}

/**
 * The drum, its axis along x through the origin, the narrow mouth at -x. Blue spiral bands on
 * white, so you can see it turn.
 */
export function mixerDrum(): Model {
  const m = new Model();
  // Smaller than a real one, so the cab and chute still show from above; one wide band, so it
  // reads as a stripe going round rather than as noise.
  const radius = (x: number) =>
    x >= 5 ? 2.4 : x >= 3 ? 3.0 : x >= -2 ? 3.4 : x >= -4 ? 3.0 : x >= -5 ? 2.4 : 1.8;
  for (let x = -6; x <= 5; x++) {
    const r = radius(x);
    for (let y = -4; y <= 3; y++)
      for (let z = -4; z <= 3; z++) {
        const cy = y + 0.5, cz = z + 0.5;
        if (cy * cy + cz * cz > r * r) continue;
        const a = Math.atan2(cy, cz) / (Math.PI * 2);
        const band = (((a + x / 10) % 1) + 1) % 1;
        m.set(x, y, z, x === -6 ? C.Dark : band < 0.4 ? C.Mixer : C.White);
      }
  }
  return m;
}

// ---------------------------------------------------------------- crane (red)

export function craneCarrier(): Model {
  const P = C.Crane;
  const m = new Model();
  m.box(-13, 2, -4, 26, 3, 8, P);
  for (const x0 of [9, 5, -7, -11]) {
    m.box(x0, 0, -5, 3, 4, 1, C.Rubber).box(x0, 0, 4, 3, 4, 1, C.Rubber);
    m.box(x0, 0, -4, 3, 2, 8, C.Rubber);
    m.set(x0 + 1, 1, -5, C.Gray).set(x0 + 1, 1, 4, C.Gray);
  }
  m.box(-12, 3, -4, 7, 1, 1, C.White).box(-12, 3, 3, 7, 1, 1, C.White);
  // The driving cab, front left.
  m.box(9, 5, -4, 4, 4, 4, P);
  bevelTop(m, 9, 8, -4, 4, 4);
  m.box(12, 6, -4, 1, 2, 3, C.Glass);
  m.box(10, 6, -4, 2, 2, 1, C.Glass);
  m.box(13, 2, -4, 1, 2, 8, C.Steel);
  m.set(13, 3, -4, C.Light).set(13, 3, 3, C.Light);
  // A boom rest on the right for the boom to lie on when driving.
  m.box(8, 5, 0, 1, 2, 3, C.Steel);
  // Outrigger boxes at the corners, hazard striped.
  for (const x0 of [6, -13]) m.box(x0, 4, -4, 2, 1, 8, C.Steel).box(x0, 4, -4, 1, 1, 8, C.Hazard);
  return m;
}

/** The turning top: turntable, housing, the operator's cab and counterweight. Pivot at its middle. */
export function craneTop(): Model {
  const P = C.Crane;
  const m = new Model();
  m.box(-3, 0, -3, 6, 1, 6, C.Dark);
  m.box(-6, 1, -4, 9, 3, 8, P);
  bevelTop(m, -6, 3, -4, 9, 8);
  m.box(-7, 1, -4, 1, 3, 8, C.Steel); // counterweight
  m.box(-6, 2, -4, 5, 1, 1, C.White).box(-6, 2, 3, 5, 1, 1, C.White);
  // Operator's cab, on the left, looking along the boom.
  m.box(-1, 4, -4, 4, 4, 3, P);
  m.box(2, 5, -4, 1, 2, 3, C.Glass);
  m.box(0, 5, -4, 2, 2, 1, C.Glass);
  bevelTop(m, -1, 7, -4, 4, 3);
  // Boom foot: steel lugs on the right.
  m.box(-4, 4, -1, 3, 2, 4, C.Steel);
  return m;
}

/**
 * The boom telescopes in three sections, each sleeved inside the one before: 4, 3 and 2 cells
 * across, all centred on the boom's line (build the middle one with pivot [0, 0.5, 0.5] so it sits
 * centred too). Each is BOOM_SECTION cells long, and none slides out further than leaves a good
 * length still inside its sleeve, so the boom never shows a gap.
 */
export const BOOM_SECTION = 22;

/** The outer section, from its foot (pivot at cell 0). */
export function craneBoomBase(): Model {
  const L = BOOM_SECTION;
  const m = new Model();
  m.box(0, -2, -2, L, 4, 4, C.Crane);
  m.box(1, 0, -2, L - 3, 1, 1, C.White).box(1, 0, 1, L - 3, 1, 1, C.White); // a stripe down each side
  // A dark collar at the mouth, where the next section comes out.
  m.box(L - 1, -2, -2, 1, 4, 4, C.Dark).clear(L - 1, -1, -1, 1, 2, 2);
  m.box(-1, -1, -1, 2, 2, 2, C.Steel); // foot pin
  return m;
}

/** The middle section. */
export function craneBoomMid(): Model {
  const m = new Model();
  m.box(0, -1, -1, BOOM_SECTION, 3, 3, 0xe85a48);
  m.box(BOOM_SECTION - 1, -1, -1, 1, 3, 3, C.Dark).clear(BOOM_SECTION - 1, 0, 0, 1, 1, 1);
  return m;
}

/** The inner section; its head carries the sheave the cable runs over. */
export function craneBoomFly(): Model {
  const L = BOOM_SECTION;
  const m = new Model();
  m.box(0, -1, -1, L, 2, 2, C.Gray);
  m.box(L - 2, -2, -2, 3, 3, 4, C.Steel); // sheave head
  m.box(L - 1, -2, -1, 1, 1, 2, C.Dark);
  m.box(L - 2, 0, -2, 3, 1, 4, C.Hazard); // a hazard cap, so the tip reads from above
  return m;
}

/** The hook block, hazard yellow with a dark hook; the cable meets it at its top (y = 0). */
export function craneHook(): Model {
  const m = new Model();
  m.box(-1, -3, -1, 3, 3, 3, C.Hazard);
  m.box(-1, -2, -1, 3, 1, 3, C.Dark);
  m.box(0, -5, 0, 1, 2, 1, C.Steel);
  m.box(0, -6, 0, 2, 1, 1, C.Steel);
  return m;
}

// ---------------------------------------------------------------- the building

export interface PanelStyle {
  paint: number;
  windows: number[]; // window centres along the panel, in cells
  door?: boolean; // a front door in the middle
  doorAt?: number; // ...or at this many cells along
  doorPaint?: number;
  upper?: boolean; // an upper storey's panel: a trim band at the foot instead of the plinth
  trim?: number; // the top band (and an upper panel's foot), white by default
  shopWindow?: [number, number]; // a big shop window from..to, in cells
  awning?: [number, number]; // a striped awning over the front, sticking out (+z)
  garage?: [number, number]; // a big roller door from..to, in cells
}

/**
 * A wall panel, `len` cells long, 14 high, 2 thick, lying along x. +z is the face that's outside
 * on the front wall, so awnings stick out that way.
 */
export function wallPanel(len: number, s: PanelStyle): Model {
  const trim = s.trim ?? C.White;
  const m = new Model();
  m.box(0, 0, 0, len, 14, 2, s.paint);
  m.box(0, 0, 0, len, 1, 2, s.upper ? trim : C.Gray); // plinth, or a floor band upstairs
  m.box(0, 13, 0, len, 1, 2, trim); // top band
  for (const wx of s.windows) {
    m.box(wx - 3, 5, 0, 6, 6, 2, C.White);
    m.box(wx - 2, 6, 0, 4, 4, 2, C.Glass);
    m.box(wx - 2, 8, 0, 4, 1, 2, C.White).box(wx, 6, 0, 1, 4, 2, C.White);
    m.box(wx - 3, 4, 0, 6, 1, 3, C.White); // sill
  }
  if (s.shopWindow) {
    const [a, b] = s.shopWindow;
    m.box(a - 1, 2, 0, b - a + 2, 9, 2, C.White);
    m.box(a, 3, 0, b - a, 7, 2, C.Glass);
    for (let x = a + 6; x < b - 2; x += 7) m.box(x, 3, 0, 1, 7, 2, C.White);
  }
  if (s.garage) {
    const [a, b] = s.garage;
    m.box(a - 1, 1, 0, b - a + 2, 11, 2, C.White);
    for (let y = 1; y < 11; y++) m.box(a, y, 0, b - a, 1, 2, y % 2 ? 0xe8443a : 0xc9332b);
    m.box(a + 2, 7, 0, b - a - 4, 2, 2, C.Glass);
  }
  if (s.door || s.doorAt !== undefined) {
    const dx = s.doorAt ?? Math.floor(len / 2) - 3;
    m.box(dx - 1, 1, 0, 8, 11, 2, C.White);
    m.box(dx, 1, 0, 6, 10, 2, s.doorPaint ?? C.Wood);
    m.box(dx + 1, 6, 2, 1, 1, 1, C.Hazard); // knob, on the outside
    m.box(dx + 1, 8, 0, 4, 1, 2, C.Glass);
  }
  if (s.awning) {
    const [c1, c2] = s.awning;
    for (let x = 1; x < len - 1; x++) {
      const c = Math.floor(x / 3) % 2 ? c1 : c2;
      m.box(x, 12, 2, 1, 1, 2, c).box(x, 11, 4, 1, 1, 2, c);
      if (x % 3 === 1) m.set(x, 10, 5, c); // a scalloped edge
    }
  }
  return m;
}

export interface RoofColours {
  tile: number;
  tile2: number;
  under: number;
  gable: number;
}

/**
 * A stepped gable roof over a `w` x `d` tile footprint (2 cells of overhang all round), the ridge
 * along x, cream gable ends, an optional brick chimney. Pivot it at [W/2, 0, D/2].
 */
export function gableRoof(w: number, d: number, c: RoofColours, chimney = true): Model {
  const m = new Model();
  const W = w * 10 + 4, D = d * 10 + 4;
  const ridge = Math.round(D / 5);
  for (let z = 0; z < D; z++) {
    const h = Math.min(ridge, 1 + Math.floor(Math.min(z, D - 1 - z) / 2.2));
    for (let x = 0; x < W; x++)
      for (let y = 0; y < h; y++) {
        const top = y === h - 1;
        const gable = (x === 2 || x === W - 3) && !top;
        if (x < 2 || x > W - 3) {
          if (top) m.set(x, y, z, c.tile2); // eaves overhang at the gable ends: just the tiles
          continue;
        }
        m.set(x, y, z, top ? (z % 4 < 2 ? c.tile : c.tile2) : gable ? c.gable : c.under);
      }
  }
  if (chimney) {
    const cx = W - 14, cz = Math.round(D * 0.2);
    m.box(cx, 4, cz, 4, 8, 4, 0xa0522d).box(cx, 11, cz, 4, 1, 4, C.Dark).box(cx + 1, 11, cz + 1, 2, 1, 2, 0x161616);
  }
  return m;
}

/** How tall a gable roof is, in cells. */
export function gableHeight(d: number): number {
  return Math.round((d * 10 + 4) / 5);
}

/** A flat roof with a low parapet and a vent or two. Pivot it at [W/2, 0, D/2]. */
export function flatRoof(w: number, d: number, top: number, edge: number): Model {
  const m = new Model();
  const W = w * 10 + 2, D = d * 10 + 2;
  m.box(0, 0, 0, W, 2, D, top);
  m.box(0, 2, 0, W, 1, 1, edge).box(0, 2, D - 1, W, 1, 1, edge).box(0, 2, 0, 1, 1, D, edge).box(W - 1, 2, 0, 1, 1, D, edge);
  m.box(0, 1, 0, W, 1, 1, edge).box(0, 1, D - 1, W, 1, 1, edge);
  m.box(6, 2, 6, 4, 2, 4, C.Gray).box(7, 4, 7, 2, 1, 2, C.Dark); // a vent
  return m;
}

/** A giant ice-cream cone for the shop's roof, standing on a flat roof's top (y = 2). */
export function iceCream(m: Model, cx: number, cz: number, scoop1: number, scoop2: number): Model {
  const Cone = 0xe0a85a, Waffle = 0xc98a3e;
  // The cone: stepping wider as it rises.
  for (let y = 0; y < 8; y++) {
    const r = 1 + Math.floor(y / 2.5);
    for (let x = -r; x < r; x++)
      for (let z = -r; z < r; z++) m.set(cx + x, 2 + y, cz + z, (x + z + y) % 3 === 0 ? Waffle : Cone);
  }
  // A ball centred on the corner between cells, like the cone.
  const ball = (y0: number, r: number, col: number) => {
    for (let x = -r - 1; x <= r; x++)
      for (let y = -r - 1; y <= r; y++)
        for (let z = -r - 1; z <= r; z++) {
          const dx = x + 0.5, dy = y + 0.5, dz = z + 0.5;
          if (dx * dx + dy * dy + dz * dz <= r * r) m.set(cx + x, y0 + y, cz + z, col);
        }
  };
  ball(13, 4, scoop1);
  ball(18, 3, scoop2);
  m.box(cx - 1, 21, cz - 1, 2, 2, 2, 0xd8263a); // the cherry
  m.set(cx, 23, cz, 0x3f9440);
  return m;
}

/** The fire station's little hose tower with a bell, on a flat roof's top. */
export function bellTower(m: Model, x0: number, z0: number): Model {
  const Brick = 0xb5523b;
  m.box(x0, 2, z0, 10, 12, 10, Brick);
  m.box(x0, 9, z0, 10, 1, 10, C.White);
  m.box(x0 + 2, 10, z0, 6, 3, 10, C.Dark).box(x0, 10, z0 + 2, 10, 3, 6, C.Dark); // open belfry
  m.box(x0 + 4, 10, z0 + 4, 2, 2, 2, C.Hazard); // the bell
  for (let k = 0; k < 4; k++) m.box(x0 - 1 + k, 14 + k, z0 - 1 + k, 12 - 2 * k, 1, 12 - 2 * k, 0x4a4f57); // a stepped cap
  m.box(x0 + 4, 18, z0 + 4, 2, 2, 2, 0xff3b30); // a red light on top
  return m;
}

// ---------------------------------------------------------------- people and props

/** The worker: a little builder in a hard hat and hi-vis vest, about 0.8 tile tall. */
export function worker(): Model {
  const Skin = 0xf6d3a6, Pants = 0x3c4652, Boots = 0x3b2a20, Vest = 0xff8a1f, Hat = 0xf2c200;
  const m = new Model();
  for (const z of [-2, 1]) m.box(-1, 0, z, 2, 4, 2, Pants).box(-1, 0, z, 2, 1, 2, Boots);
  m.box(-2, 4, -3, 4, 5, 6, Vest).box(-2, 6, -3, 4, 1, 6, C.Hazard).box(-2, 4, -3, 4, 1, 6, 0x2b2118);
  for (const z of [-4, 3]) m.box(-1, 4, z, 2, 5, 1, Skin).box(-1, 7, z, 2, 2, 1, Vest);
  m.box(-2, 9, -2, 5, 5, 5, Skin);
  for (const z of [-1, 1]) m.set(2, 11, z, C.White).set(2, 10, z, C.Black);
  m.box(-2, 13, -2, 5, 2, 5, Hat).box(-3, 13, -3, 7, 1, 7, Hat).box(-1, 15, -1, 3, 1, 3, Hat);
  return m;
}

export function cone(): Model {
  const O = 0xff7a1a;
  return new Model()
    .box(-2, 0, -2, 4, 1, 4, C.Dark)
    .box(-1, 1, -1, 2, 2, 2, O)
    .box(-1, 3, -1, 2, 1, 2, C.White)
    .box(-1, 4, -1, 2, 2, 2, O);
}

export function tree(kind: number): Model {
  const m = new Model().box(-1, 0, -1, 3, 7, 3, 0x7a5232);
  const leaf = kind % 2 === 0 ? 0x4fae4a : 0x5cbf54;
  const dark = 0x3f9440;
  m.box(-5, 6, -5, 11, 6, 11, leaf);
  m.box(-4, 12, -4, 9, 3, 9, leaf);
  m.box(-2, 15, -2, 5, 2, 5, leaf);
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) m.clear(x, 6, z, 1, 6, 1);
  m.box(-5, 6, -5, 11, 1, 11, dark).clear(-5, 6, -5, 1, 1, 1).clear(5, 6, -5, 1, 1, 1).clear(-5, 6, 5, 1, 1, 1).clear(5, 6, 5, 1, 1, 1);
  return m;
}

/** One length of site barrier, 10 cells along x: orange and white, on dark feet. */
export function barrier(): Model {
  const O = 0xff7a1a;
  const m = new Model();
  m.box(0, 0, -1, 2, 1, 3, C.Dark).box(8, 0, -1, 2, 1, 3, C.Dark);
  m.box(0, 1, 0, 10, 4, 1, O);
  m.box(0, 2, 0, 10, 1, 1, C.White);
  m.box(4, 1, 0, 2, 1, 1, C.Dark).clear(4, 1, 0, 2, 1, 1);
  return m;
}

/** The site office: a blue cabin with a window and a door. */
export function office(): Model {
  const B = 0x4f86c6;
  const m = new Model();
  m.box(0, 0, 0, 30, 2, 20, C.Gray);
  m.box(0, 2, 0, 30, 16, 20, B);
  m.box(0, 18, 0, 30, 1, 20, C.White);
  m.box(4, 7, 19, 10, 7, 1, C.White).box(5, 8, 19, 8, 5, 1, C.Glass);
  m.box(19, 2, 19, 6, 12, 1, C.White).box(20, 2, 19, 4, 11, 1, 0x2f5f99);
  m.box(18, 0, 20, 8, 2, 3, C.Steel);
  return m;
}

/** The flatbed trailer the wall panels arrive on: 44 long along x. */
export function trailer(): Model {
  const m = new Model();
  m.box(0, 3, 0, 44, 2, 18, C.Steel);
  m.box(0, 5, 0, 44, 1, 1, C.Hazard).box(0, 5, 17, 44, 1, 1, C.Hazard);
  for (const x0 of [6, 34]) m.box(x0, 0, 0, 4, 4, 1, C.Rubber).box(x0, 0, 17, 4, 4, 1, C.Rubber);
  m.box(44, 1, 7, 5, 2, 4, C.Dark); // hitch
  return m;
}

export function pallet(): Model {
  const m = new Model();
  for (const x of [0, 21, 42]) m.box(x, 0, 0, 3, 2, 46, 0x8a5a33);
  m.box(0, 2, 0, 45, 1, 46, 0xb08050);
  return m;
}

/** A dirt mound by a dig spot, one size per bucketful. */
export function mound(size: number): Model {
  const m = new Model();
  const r = 3 + size * 2.2;
  const h = 1 + size * 1.6;
  for (let x = -8; x <= 8; x++)
    for (let z = -8; z <= 8; z++) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d > r) continue;
      const top = Math.max(1, Math.round(h * (1 - (d / r) * (d / r))));
      for (let y = 0; y < top; y++) m.set(x, y, z, y === top - 1 && (x + z) % 3 === 0 ? 0x86592f : C.Earth);
    }
  return m;
}

/** A corner peg with its little white board, for the string lines round the footprint. */
export function peg(): Model {
  return new Model().box(0, 0, 0, 1, 5, 1, C.Wood).box(-1, 4, 0, 3, 1, 1, C.White);
}

/** The finale's flag on the roof ridge. */
export function flag(): Model {
  return new Model().box(0, 0, 0, 1, 10, 1, C.Steel).box(1, 6, 0, 5, 4, 1, 0x3fb950).box(1, 7, 0, 5, 1, 1, C.Hazard);
}

// ---------------------------------------------------------------- road roller (green)

export const RollerPaint = 0x2ea05a;

/** The roller's body: open seat under a canopy, rear wheels, and the yoke the drum turns in at the front. */
export function rollerBody(): Model {
  const P = RollerPaint;
  const m = new Model();
  // Rear wheels.
  for (const z0 of [-6, 4]) {
    m.box(-9, 0, z0, 5, 4, 2, C.Rubber);
    m.clear(-9, 0, z0, 1, 1, 2).clear(-9, 3, z0, 1, 1, 2).clear(-5, 0, z0, 1, 1, 2).clear(-5, 3, z0, 1, 1, 2);
    m.box(-8, 1, z0 < 0 ? z0 : z0 + 1, 3, 2, 1, C.Steel);
  }
  // Body and engine.
  m.box(-10, 2, -4, 12, 4, 8, P);
  bevelTop(m, -10, 5, -4, 12, 8);
  m.box(-10, 6, -3, 5, 1, 6, C.Gray).box(-9, 7, -2, 3, 1, 4, C.Dark); // engine grille on top
  m.box(-6, 6, 3, 1, 3, 1, C.Dark); // exhaust
  m.box(-10, 4, -4, 12, 1, 1, C.White).box(-10, 4, 3, 12, 1, 1, C.White);
  // Seat and wheel.
  m.box(-4, 6, -2, 3, 1, 4, C.Dark).box(-4, 7, -2, 1, 3, 4, C.Dark);
  m.box(0, 6, -1, 1, 3, 2, C.Gray).box(0, 9, -2, 1, 1, 4, C.Dark);
  // Canopy on four posts.
  for (const [x, z] of [[-5, -4], [-5, 3], [1, -4], [1, 3]]) m.box(x, 6, z, 1, 6, 1, C.Dark);
  m.box(-6, 12, -5, 9, 1, 10, P);
  bevelTop(m, -6, 12, -5, 9, 10);
  // Yoke round the drum: two arms forward from the body, and a hazard bar across the front.
  m.box(2, 3, -6, 9, 3, 1, P).box(2, 3, 5, 9, 3, 1, P);
  m.box(2, 5, -5, 2, 1, 10, P);
  m.box(10, 6, -6, 2, 1, 12, C.Hazard);
  m.box(10, 3, -6, 2, 3, 1, P).box(10, 3, 5, 2, 3, 1, P);
  return m;
}

/** The big front drum, centred on its axle (along z): steel, with dark bands so it reads as turning. */
export function rollerDrum(): Model {
  const m = new Model();
  const r = 3.6;
  for (let x = -4; x < 4; x++)
    for (let y = -4; y < 4; y++) {
      const cx = x + 0.5, cy = y + 0.5;
      if (cx * cx + cy * cy > r * r) continue;
      const a = (Math.atan2(cy, cx) / (Math.PI * 2) + 1) * 8;
      for (let z = -5; z < 5; z++) m.set(x, y, z, Math.floor(a) % 2 && Math.abs(z + 0.5) < 4 ? C.Gray : C.Steel);
    }
  return m;
}

// ---------------------------------------------------------------- bulldozer (purple)

export const DozerPaint = 0x8a5cd6;

/** A bulldozer: low tracks, a cab with a white roof, and a wide blade out front that does the pushing. */
export function dozer(): Model {
  const P = DozerPaint;
  const m = new Model();
  for (const z0 of [-6, 3]) {
    m.box(-8, 0, z0, 15, 3, 3, C.Rubber);
    m.clear(-8, 0, z0, 1, 1, 3).clear(-8, 2, z0, 1, 1, 3).clear(6, 0, z0, 1, 1, 3).clear(6, 2, z0, 1, 1, 3);
    const outer = z0 < 0 ? z0 : z0 + 2;
    for (let x = -6; x <= 4; x += 5) m.box(x, 1, outer, 2, 1, 1, C.Steel);
  }
  m.box(-7, 2, -4, 13, 4, 8, P);
  bevelTop(m, -7, 5, -4, 13, 8);
  m.box(-7, 4, -4, 13, 1, 1, C.White).box(-7, 4, 3, 13, 1, 1, C.White);
  // Engine hood in front of the cab, a grille and an exhaust.
  m.box(1, 6, -3, 5, 2, 6, P);
  m.box(5, 6, -2, 1, 2, 4, C.Dark);
  m.box(3, 8, 2, 1, 3, 1, C.Dark);
  // Cab.
  m.box(-6, 6, -4, 6, 6, 8, P);
  m.box(-1, 8, -3, 1, 3, 6, C.Glass);
  m.box(-5, 8, -4, 3, 3, 1, C.Glass).box(-5, 8, 3, 3, 3, 1, C.Glass);
  m.box(-6, 12, -4, 6, 1, 8, C.White);
  bevelTop(m, -6, 12, -4, 6, 8);
  m.box(-10, 1, -1, 3, 4, 2, C.Steel); // ripper
  // Push arms out to the blade.
  m.box(6, 2, -6, 4, 2, 1, P).box(6, 2, 5, 4, 2, 1, P);
  // The blade: wide, curved back at the top, a steel cutting edge and a hazard top.
  m.box(10, 0, -8, 2, 6, 16, P);
  m.box(9, 5, -8, 1, 2, 16, P);
  m.box(11, 0, -8, 1, 1, 16, C.Steel);
  m.box(9, 7, -8, 2, 1, 16, C.Hazard);
  return m;
}

/** What the truck carries from the yard to a lot: a pallet of panels and a crate of bits. */
export function cargo(): Model {
  const m = new Model();
  m.box(0, 0, 0, 5, 1, 6, 0x8a5a33);
  const cols = [0x9ad9b5, 0xf6b38a, 0xb9a6e6, 0x8fc8f0];
  for (let k = 0; k < 4; k++) m.box(0, 1 + k, 0, 5, 1, 6, cols[k]);
  return m;
}

export function crate(): Model {
  const m = new Model().box(0, 0, 0, 3, 3, 3, C.Wood);
  m.box(0, 1, 0, 3, 1, 3, 0x7a522c);
  return m;
}

// ---------------------------------------------------------------- the town

export const TruckPaint = 0xff8a1f;

/** The crew's little pickup truck, for getting about town. */
export function truck(): Model {
  const P = TruckPaint;
  const m = new Model();
  for (const x0 of [4, -8]) {
    for (const z0 of [-5, 4]) {
      m.box(x0, 0, z0, 4, 3, 1, C.Rubber).clear(x0, 0, z0, 1, 1, 1).clear(x0 + 3, 0, z0, 1, 1, 1);
      m.set(x0 + 1, 1, z0, C.Gray).set(x0 + 2, 1, z0, C.Gray);
    }
  }
  m.box(-10, 1, -4, 20, 2, 8, C.Dark);
  m.box(-10, 2, -4, 21, 3, 8, P);
  m.box(-10, 4, -4, 21, 1, 1, C.White).box(-10, 4, 3, 21, 1, 1, C.White);
  // Cab.
  m.box(-1, 5, -4, 7, 4, 8, P);
  m.box(-1, 9, -4, 6, 1, 8, C.White);
  bevelTop(m, -1, 9, -4, 6, 8);
  m.box(5, 6, -3, 1, 2, 6, C.Glass);
  m.box(0, 6, -4, 4, 2, 1, C.Glass).box(0, 6, 3, 4, 2, 1, C.Glass);
  m.box(11, 2, -4, 1, 2, 8, C.Steel);
  m.set(11, 3, -4, C.Light).set(11, 3, 3, C.Light);
  m.box(6, 5, -3, 4, 1, 6, P); // bonnet
  // The bed: low sides, empty for the load.
  m.box(-10, 5, -4, 9, 1, 1, P).box(-10, 5, 3, 9, 1, 1, P).box(-10, 5, -4, 1, 1, 8, P);
  return m;
}

export interface Look {
  shirt: number;
  pants: number;
  hair: number;
  skin: number;
  hat?: number;
}

/** A person, in 1/20-tile cells like the worker: about 0.8 tile tall (a child's 0.6). */
export function person(l: Look, child = false): Model {
  const m = new Model();
  const legs = child ? 3 : 4;
  for (const z of [-2, 1]) m.box(-1, 0, z, 2, legs, 2, l.pants).box(-1, 0, z, 2, 1, 2, 0x3b2a20);
  const b = legs;
  const bodyH = child ? 4 : 5;
  m.box(-2, b, -3, 4, bodyH, 6, l.shirt);
  for (const z of [-4, 3]) m.box(-1, b, z, 2, bodyH, 1, l.shirt).box(-1, b, z, 2, 1, 1, l.skin);
  const h = b + bodyH;
  m.box(-2, h, -2, 5, 5, 5, l.skin);
  for (const z of [-1, 1]) m.set(2, h + 2, z, C.Black);
  m.set(2, h + 1, 0, 0xe0866b); // a smile
  m.box(-2, h + 4, -2, 5, 2, 5, l.hair).box(-2, h + 1, -2, 1, 4, 5, l.hair);
  if (l.hat !== undefined) m.box(-3, h + 5, -3, 7, 1, 7, l.hat).box(-2, h + 6, -2, 5, 1, 5, l.hat);
  return m;
}

/** One length of white picket fence, 10 cells along x. */
export function picket(): Model {
  const m = new Model();
  for (let x = 0; x < 10; x += 2) m.box(x, 0, 0, 1, 5, 1, C.White).clear(x, 4, 0, 1, 1, 1).set(x, 4, 0, 0xe8e8e8);
  m.box(0, 1, 0, 10, 1, 1, C.White).box(0, 3, 0, 10, 1, 1, C.White);
  return m;
}

/** A row of flowers, `len` cells along x. */
export function flowers(len: number, seed: number): Model {
  const m = new Model();
  const cols = [0xff5d8f, 0xffc93c, 0xffffff, 0xc77dff, 0xff8a1f];
  m.box(0, 0, 0, len, 1, 3, 0x6b4a2b);
  for (let x = 0; x < len; x += 2) {
    const z = (x * 7 + seed) % 3;
    m.box(x, 1, z, 1, 2, 1, 0x3f9440);
    m.set(x, 3, z, cols[(x + seed) % cols.length]);
  }
  return m;
}

/** A round bush. */
export function bush(shade = 0): Model {
  const m = new Model();
  const c = shade ? 0x4fae4a : 0x3f9a45;
  for (let x = -3; x < 3; x++)
    for (let y = 0; y < 5; y++)
      for (let z = -3; z < 3; z++) {
        const dx = x + 0.5, dy = y - 1.5, dz = z + 0.5;
        if (dx * dx + dy * dy * 1.3 + dz * dz <= 10) m.set(x, y, z, (x + y + z) % 4 === 0 ? 0x5cbf54 : c);
      }
  return m;
}

export function lamp(): Model {
  return new Model().box(-1, 0, -1, 2, 1, 2, C.Dark).box(0, 0, 0, 1, 16, 1, 0x3a3f47).box(-1, 16, -1, 3, 1, 3, 0x3a3f47).box(-1, 15, -1, 3, 1, 3, C.Light);
}

export function bench(): Model {
  const m = new Model();
  m.box(0, 0, 0, 1, 2, 3, C.Dark).box(9, 0, 0, 1, 2, 3, C.Dark);
  m.box(0, 2, 0, 10, 1, 3, C.Wood).box(0, 3, 2, 10, 2, 1, C.Wood);
  return m;
}

export function mailbox(paint: number): Model {
  return new Model().box(0, 0, 0, 1, 5, 1, C.Wood).box(-1, 5, -1, 4, 2, 3, paint).set(2, 7, 1, 0xd8263a);
}

/** The plinth an empty lot's little model of its building turns on. */
export function plinth(): Model {
  const m = new Model();
  for (let x = -5; x < 5; x++)
    for (let z = -5; z < 5; z++) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d > 5) continue;
      m.set(x, 0, z, C.Gray).set(x, 1, z, C.Gray);
      if (d <= 4.2) m.set(x, 2, z, C.White);
    }
  return m;
}
