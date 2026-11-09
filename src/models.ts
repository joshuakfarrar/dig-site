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

/**
 * A flat cab roof seen from above: a rim in the machine's paint round a white panel, square
 * cornered, so it reads as a roof and not a white blob (rounded white tops looked like eggs).
 */
function cabRoof(m: Model, x0: number, y: number, z0: number, w: number, d: number, paint: number, inner: number = C.White): Model {
  m.box(x0, y, z0, w, 1, d, paint);
  if (w > 2 && d > 2) m.box(x0 + 1, y, z0 + 1, w - 2, 1, d - 2, inner);
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
export const BOOM_SECTION = 24;

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
  garagePaint?: [number, number]; // its two stripes, red by default
  /** More than one front door (a duplex, a terrace): each one's middle-left cell and its paint. */
  doors?: { at: number; paint: number }[];
  /** Stretches painted differently (each home in a row its own colour), from..to in cells. */
  bands?: { from: number; to: number; paint: number }[];
  /** Upstairs balconies: each one's middle, in cells, with a glass door behind it. */
  balconies?: number[];
  /** White columns standing out in front (a library, a town hall): each one's left cell. */
  columns?: number[];
  /** Not a wall at all: a playground's rainbow fence (the front one with a gap to go in). */
  fence?: { gate: boolean };
}

/**
 * A wall panel, `len` cells long, 14 high, 2 thick, lying along x. +z is the face that's outside
 * on the front wall, so awnings stick out that way.
 */
export function wallPanel(len: number, s: PanelStyle): Model {
  if (s.fence) return playFence(len, s.fence.gate);
  const trim = s.trim ?? C.White;
  const m = new Model();
  m.box(0, 0, 0, len, 14, 2, s.paint);
  for (const b of s.bands ?? []) m.box(b.from, 1, 0, b.to - b.from, 12, 2, b.paint);
  // A thin white line where two homes in a row meet.
  for (const b of s.bands ?? []) if (b.from > 0) m.box(b.from, 1, 0, 1, 12, 2, trim);
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
    const [g1, g2] = s.garagePaint ?? [0xe8443a, 0xc9332b];
    for (let y = 1; y < 11; y++) m.box(a, y, 0, b - a, 1, 2, y % 2 ? g1 : g2);
    m.box(a + 2, 7, 0, b - a - 4, 2, 2, C.Glass);
  }
  const door = (dx: number, paint: number) => {
    m.box(dx - 1, 1, 0, 8, 11, 2, C.White);
    m.box(dx, 1, 0, 6, 10, 2, paint);
    m.box(dx + 1, 6, 2, 1, 1, 1, C.Hazard); // knob, on the outside
    m.box(dx + 1, 8, 0, 4, 1, 2, C.Glass);
  };
  if (s.door || s.doorAt !== undefined) door(s.doorAt ?? Math.floor(len / 2) - 3, s.doorPaint ?? C.Wood);
  for (const d of s.doors ?? []) door(d.at, d.paint);
  for (const cx of s.columns ?? []) m.box(cx, 1, 2, 2, 12, 2, C.White).box(cx - 1, 1, 2, 4, 1, 3, C.White).box(cx - 1, 12, 2, 4, 1, 3, C.White);
  for (const bx of s.balconies ?? []) {
    // A glass door, and a little balcony out in front of it with a railing and a pot plant.
    m.box(bx - 4, 1, 0, 8, 11, 2, C.White);
    m.box(bx - 3, 1, 0, 6, 10, 2, C.Glass);
    m.box(bx, 1, 0, 1, 10, 2, C.White);
    m.box(bx - 5, 0, 2, 10, 1, 4, C.Concrete);
    for (let x = bx - 5; x < bx + 5; x += 2) m.box(x, 1, 5, 1, 3, 1, C.White);
    m.box(bx - 5, 1, 2, 1, 3, 4, C.White).box(bx + 4, 1, 2, 1, 3, 4, C.White);
    m.box(bx - 5, 4, 2, 10, 1, 4, C.White).clear(bx - 4, 4, 2, 8, 1, 3);
    m.box(bx + 2, 1, 3, 2, 2, 2, 0xc0573f).box(bx + 2, 3, 3, 2, 2, 2, 0x4fae4a);
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

/**
 * A giant ice-cream cone for the shop's roof, standing on a flat roof's top (y = 2). The cone's tall
 * and flares out as wide as the first scoop, with a criss-cross waffle, so from the high camera it
 * reads as a cone and not just a blob of scoops.
 */
export function iceCream(m: Model, cx: number, cz: number, scoop1: number, scoop2: number): Model {
  const Cone = 0xe8b465, Waffle = 0xb87a34;
  const H = 12;
  for (let y = 0; y < H; y++) {
    const r = 1 + (3.2 * y) / (H - 1); // 1 at the tip, about 4 at the top
    const n = Math.ceil(r);
    for (let x = -n; x < n; x++)
      for (let z = -n; z < n; z++) {
        if (Math.hypot(x + 0.5, z + 0.5) > r + 0.25) continue;
        const grid = ((x + y) % 3 + 3) % 3 === 0 || ((z - y) % 3 + 3) % 3 === 0;
        m.set(cx + x, 2 + y, cz + z, grid ? Waffle : Cone);
      }
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
  const top = 2 + H;
  ball(top + 3, 4, scoop1);
  // A few drips of the first scoop down over the cone's rim.
  for (const [x, z, len] of [[-4, 0, 2], [3, -2, 3], [1, 3, 2], [-2, -4, 1]] as const)
    for (let k = 1; k <= len; k++) m.set(cx + x, top - k, cz + z, scoop1);
  ball(top + 8, 3, scoop2);
  m.box(cx - 1, top + 11, cz - 1, 2, 2, 2, 0xd8263a); // the cherry
  m.set(cx, top + 13, cz, 0x3f9440);
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
  cabRoof(m, -6, 12, -4, 6, 8, P);
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
  cabRoof(m, -1, 9, -4, 6, 8, P);
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
  scarf?: number; // a headscarf over the hair
  long?: boolean; // long hair, down to the shoulders
  dress?: boolean; // a dress (the shirt colour carries on as a skirt) instead of trousers
}

/** A person, in 1/20-tile cells like the worker: about 0.8 tile tall (a child's 0.6). */
export function person(l: Look, child = false): Model {
  const m = new Model();
  const legs = child ? 3 : 4;
  for (const z of [-2, 1]) m.box(-1, 0, z, 2, legs, 2, l.dress ? l.skin : l.pants).box(-1, 0, z, 2, 1, 2, 0x3b2a20);
  const b = legs;
  const bodyH = child ? 4 : 5;
  m.box(-2, b, -3, 4, bodyH, 6, l.shirt);
  if (l.dress) m.box(-2, b - 2, -3, 4, 2, 6, l.shirt).box(-3, b - 2, -3, 1, 1, 6, l.shirt); // the skirt, a little flared
  for (const z of [-4, 3]) m.box(-1, b, z, 2, bodyH, 1, l.shirt).box(-1, b, z, 2, 1, 1, l.skin);
  head(m, l, b + bodyH);
  return m;
}

/** A face and hair (or a headscarf) on a head whose bottom is at `h`, looking along +x. */
function head(m: Model, l: Look, h: number): void {
  m.box(-2, h, -2, 5, 5, 5, l.skin);
  for (const z of [-1, 1]) m.set(2, h + 2, z, C.Black);
  m.set(2, h + 1, 0, 0xe0866b); // a smile
  if (l.scarf !== undefined) {
    // Round the back, both sides and over the top, framing the face.
    m.box(-3, h - 1, -3, 1, 7, 7, l.scarf);
    m.box(-3, h - 1, -3, 5, 7, 1, l.scarf).box(-3, h - 1, 3, 5, 7, 1, l.scarf);
    m.box(-3, h + 5, -3, 5, 1, 7, l.scarf);
    m.box(2, h + 4, -2, 1, 1, 5, l.scarf);
    return;
  }
  m.box(-2, h + 4, -2, 5, 2, 5, l.hair).box(-2, h + 1, -2, 1, 4, 5, l.hair);
  if (l.long) m.box(-3, h - 2, -2, 1, 7, 5, l.hair).box(-2, h, -3, 2, 5, 1, l.hair).box(-2, h, 3, 2, 5, 1, l.hair);
  if (l.hat !== undefined) m.box(-3, h + 5, -3, 7, 1, 7, l.hat).box(-2, h + 6, -2, 5, 1, 5, l.hat);
}

/** An older person with a walking stick (grey or white hair goes in the look). */
export function elder(l: Look): Model {
  const m = person(l);
  m.box(3, 0, 3, 1, 6, 1, 0x8a5a3c).box(2, 6, 3, 2, 1, 1, 0x8a5a3c); // the stick, held out front
  return m;
}

/**
 * Someone in a wheelchair: sitting, big wheels either side, little castors in front. Faces +x like
 * everyone else; about as tall as a child standing.
 */
export function wheelchair(l: Look): Model {
  const m = new Model();
  const Frame = 0x3a3f47, Tyre = 0x262626, Seat = 0x2f74d0;
  // The big wheels, round in the x-y plane, on both sides.
  for (const z of [-5, 4]) {
    for (let x = -4; x <= 3; x++)
      for (let y = 0; y <= 7; y++) {
        const d = Math.hypot(x + 0.5, y - 3.5);
        if (d <= 4) m.set(x, y, z, d > 3 ? Tyre : d < 1 ? C.Steel : (x + y) % 3 === 0 ? C.Steel : Frame);
      }
  }
  m.box(4, 0, -3, 1, 1, 1, Tyre).box(4, 0, 2, 1, 1, 1, Tyre).box(4, 1, -3, 1, 2, 1, Frame).box(4, 1, 2, 1, 2, 1, Frame);
  m.box(-3, 4, -4, 7, 1, 8, Seat); // the seat
  m.box(-4, 4, -4, 1, 8, 8, Seat); // the back
  m.box(-5, 10, -4, 1, 1, 1, Frame).box(-5, 10, 3, 1, 1, 1, Frame); // push handles
  // The person, sitting: legs out along the seat and down, body up the back.
  for (const z of [-2, 1]) m.box(0, 5, z, 4, 2, 2, l.pants).box(4, 1, z, 2, 5, 2, l.pants).box(4, 0, z, 3, 1, 2, 0x3b2a20);
  m.box(-3, 5, -3, 4, 5, 6, l.shirt);
  for (const z of [-4, 3]) m.box(-2, 6, z, 3, 4, 1, l.shirt).box(1, 6, z, 1, 1, 1, l.skin);
  head(m, l, 10);
  return m;
}

/** A small dog with a waggy tail. */
export function dog(coat: number, patch: number): Model {
  const m = new Model();
  for (const [x, z] of [[-2, -1], [-2, 1], [2, -1], [2, 1]]) m.box(x, 0, z, 1, 2, 1, coat);
  m.box(-3, 2, -1, 7, 3, 3, coat).box(-1, 3, -1, 3, 2, 3, patch);
  m.box(3, 4, -1, 3, 3, 3, coat).box(6, 4, 0, 1, 1, 1, C.Black); // head and nose
  m.set(5, 6, -1, C.Black).set(5, 6, 1, C.Black); // eyes
  m.box(3, 7, -1, 1, 1, 1, patch).box(3, 7, 1, 1, 1, 1, patch); // ears
  m.box(-4, 4, 0, 1, 2, 1, coat); // tail
  return m;
}

/** A rooftop garden for a flat roof: planters round a patch of lawn, a bench and a little tree. */
export function roofGarden(m: Model, w: number, d: number): Model {
  const W = w * 10 + 2, D = d * 10 + 2;
  m.box(4, 2, 4, W - 8, 1, D - 8, 0x7ec850);
  for (let x = 4; x < W - 4; x += 6) m.box(x, 2, 2, 4, 2, 2, 0xb5523b).box(x, 4, 2, 4, 1, 2, 0x4fae4a);
  for (let x = 4; x < W - 4; x += 6) m.box(x, 2, D - 4, 4, 2, 2, 0xb5523b).box(x, 4, D - 4, 4, 1, 2, [0xff5d8f, 0xffc93c, 0xc77dff][(x / 6) % 3 | 0]);
  m.box(W - 12, 3, D / 2 - 1, 1, 2, 4, C.Dark).box(W - 6, 3, D / 2 - 1, 1, 2, 4, C.Dark).box(W - 12, 5, D / 2 - 1, 7, 1, 4, C.Wood); // a bench
  m.box(9, 3, 9, 2, 5, 2, 0x8a5a3c);
  for (let x = 6; x < 14; x++) for (let y = 8; y < 13; y++) for (let z = 6; z < 14; z++) {
    if (Math.hypot(x - 9.5, (y - 10) * 1.3, z - 9.5) <= 3.6) m.set(x, y, z, (x + y + z) % 4 ? 0x3f9a45 : 0x5cbf54);
  }
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
  const mod = (a: number, n: number) => ((a % n) + n) % n; // a negative seed mustn't pick no colour (black)
  for (let x = 0; x < len; x += 2) {
    const z = mod(x * 7 + seed, 3);
    m.box(x, 1, z, 1, 2, 1, 0x3f9440);
    m.set(x, 3, z, cols[mod(x + seed, cols.length)]);
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

// ---------------------------------------------------------------- Market Square's rooftops

/** A little white bell cupola for a school roof, standing on the ridge at (cx, top, cz). */
export function cupola(m: Model, cx: number, top: number, cz: number): Model {
  m.box(cx - 3, top, cz - 3, 6, 6, 6, C.White);
  m.box(cx - 2, top + 2, cz - 3, 4, 3, 6, C.Dark).box(cx - 3, top + 2, cz - 2, 6, 3, 4, C.Dark); // open belfry
  m.box(cx - 1, top + 2, cz - 1, 2, 2, 2, C.Hazard); // the bell
  for (let k = 0; k < 4; k++) m.box(cx - 4 + k, top + 6 + k, cz - 4 + k, 8 - 2 * k, 1, 8 - 2 * k, 0xd2513a);
  m.box(cx - 0, top + 10, cz - 0, 1, 2, 1, C.Hazard);
  return m;
}

/** A giant coffee cup with a saucer and a curl of steam, on a flat roof's top (y = 2). */
export function coffeeCup(m: Model, cx: number, cz: number, cup: number): Model {
  for (let x = -7; x < 7; x++)
    for (let z = -7; z < 7; z++) if (Math.hypot(x + 0.5, z + 0.5) <= 7) m.set(cx + x, 2, cz + z, C.White); // saucer
  for (let y = 0; y < 8; y++) {
    const r = 4 + (y > 1 ? 1 : 0);
    for (let x = -r; x < r; x++)
      for (let z = -r; z < r; z++) {
        const d = Math.hypot(x + 0.5, z + 0.5);
        if (d > r) continue;
        const inside = d < r - 1.2 && y > 0;
        m.set(cx + x, 3 + y, cz + z, inside ? (y === 7 ? 0x6b4226 : 0x5a3a22) : y === 4 || y === 5 ? 0xffffff : cup);
      }
  }
  // The handle, out to +x.
  m.box(cx + 5, 5, cz - 1, 1, 1, 2, cup).box(cx + 6, 5, cz - 1, 1, 4, 2, cup).box(cx + 5, 8, cz - 1, 1, 1, 2, cup);
  // Steam: three puffs going up and wiggling.
  for (const [dx, dy, dz] of [[-1, 12, 0], [0, 14, 1], [1, 16, 0], [0, 18, -1]]) m.box(cx + dx - 1, dy, cz + dz - 1, 2, 2, 2, 0xf4f4f4);
  return m;
}

/** A giant open book on a flat roof's top: two pages fanning up from the spine, and its cover. */
export function openBook(m: Model, cx: number, cz: number, cover: number): Model {
  for (let side = -1; side <= 1; side += 2)
    for (let k = 0; k < 12; k++) {
      const x = cx + side * (k + 1) - (side < 0 ? 1 : 0);
      const y = 3 + Math.round(k * 0.35);
      m.box(x, 2, cz - 8, 1, y - 2, 1, cover).box(x, 2, cz + 7, 1, y - 2, 1, cover); // cover edges
      m.box(x, y, cz - 8, 1, 1, 16, k === 11 ? cover : 0xfaf6ea);
      // A few lines of "text" (just marks: nothing to read).
      if (k > 1 && k < 10 && k % 2 === 0) for (let z = -6; z < 6; z += 3) m.box(x, y + 1, cz + z, 1, 0, 2, 0x8b929a).set(x, y + 1, cz + z, 0xb8bec4);
    }
  m.box(cx - 1, 2, cz - 8, 2, 2, 16, cover); // the spine
  m.box(cx - 1, 6, cz - 1, 2, 8, 1, 0xd8263a); // a ribbon bookmark
  return m;
}

/** A police station's light bar on its flat roof, blue and red either side of a white middle. */
export function lightBar(m: Model, cx: number, cz: number): Model {
  m.box(cx - 8, 2, cz - 2, 16, 1, 4, C.Dark);
  m.box(cx - 8, 3, cz - 2, 6, 2, 4, 0x2f74d0).box(cx - 2, 3, cz - 2, 4, 2, 4, C.White).box(cx + 2, 3, cz - 2, 6, 2, 4, 0xd8382c);
  return m;
}

/**
 * A clock tower standing up out of a gable roof at cell (cx, cz): a square tower with a white clock
 * face on all four sides (hands at ten past ten: a smile) and a pointed cap.
 */
export function clockTower(m: Model, cx: number, cz: number, base: number, brick: number): Model {
  const S = 12, H = 24;
  m.box(cx - S / 2, base, cz - S / 2, S, H, S, brick);
  m.box(cx - S / 2 - 1, base + H, cz - S / 2 - 1, S + 2, 1, S + 2, C.White);
  // A clock on each face: a white dial with a dark rim, marks at the quarters, the minute hand up
  // and the hour hand at three, and a red middle. (a, b) is across and up as you look at that face.
  const y0 = base + 13;
  const face = (a: number, b: number, c: number) => {
    m.set(cx + a, y0 + b, cz + S / 2, c); // south: across is +x
    m.set(cx - a - 1, y0 + b, cz - S / 2 - 1, c); // north: across is -x
    m.set(cx + S / 2, y0 + b, cz - a - 1, c); // east: across is -z
    m.set(cx - S / 2 - 1, y0 + b, cz + a, c); // west: across is +z
  };
  for (let a = -5; a < 5; a++)
    for (let b = -5; b < 5; b++) {
      const d = Math.hypot(a + 0.5, b + 0.5);
      if (d <= 5) face(a, b, d > 4.1 ? 0x3a3f47 : C.White);
    }
  for (const [a, b] of [[-1, 3], [0, 3], [3, -1], [3, 0], [-1, -4], [0, -4], [-4, -1], [-4, 0]]) face(a, b, 0x8b929a); // quarter marks
  for (let k = 1; k <= 3; k++) face(0, k, C.Black); // the minute hand, up
  for (let k = 1; k <= 2; k++) face(k, 0, C.Black); // the hour hand, at three
  for (const [x, y] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) face(x, y, 0xd8263a);
  // The cap: stepping in to a point, with a little gold ball on top.
  for (let k = 0; k < 7; k++) m.box(cx - S / 2 + k, base + H + 1 + k, cz - S / 2 + k, S - 2 * k, 1, S - 2 * k, 0x5b7db8);
  m.box(cx - 1, base + H + 8, cz - 1, 2, 2, 2, C.Hazard);
  return m;
}

// ---------------------------------------------------------------- the Harbour's rooftops

/**
 * A lighthouse's top, for a `w` x `w` tile tower: a gallery with a railing all round, the glass
 * lantern room with its big yellow lamp, and a red domed cap. Pivot it at [W/2, 0, W/2].
 */
export function lantern(w: number): Model {
  const m = new Model();
  const W = w * 10 + 2;
  const c = W / 2;
  m.box(-1, 0, -1, W + 2, 2, W + 2, C.Dark); // the gallery floor, sticking out a little
  for (let k = -1; k <= W; k += 2) m.box(k, 2, -1, 1, 3, 1, C.White).box(k, 2, W, 1, 3, 1, C.White).box(-1, 2, k, 1, 3, 1, C.White).box(W, 2, k, 1, 3, 1, C.White);
  m.box(-1, 5, -1, W + 2, 1, 1, C.White).box(-1, 5, W, W + 2, 1, 1, C.White).box(-1, 5, -1, 1, 1, W + 2, C.White).box(W, 5, -1, 1, 1, W + 2, C.White);
  const r = 8;
  m.box(c - r, 2, c - r, 2 * r, 1, 2 * r, C.Dark);
  m.box(c - r, 3, c - r, 2 * r, 9, 2 * r, C.Glass);
  for (const [x, z] of [[c - r, c - r], [c + r - 1, c - r], [c - r, c + r - 1], [c + r - 1, c + r - 1]]) m.box(x, 3, z, 1, 9, 1, C.Dark);
  m.box(c - 4, 4, c - 4, 8, 6, 8, 0xffe066); // the lamp
  m.box(c - 2, 6, c - r - 1, 4, 2, 1, 0xfff4b0).box(c - 2, 6, c + r, 4, 2, 1, 0xfff4b0); // its shine through the glass
  for (let k = 0; k < 6; k++) m.box(c - r - 1 + k, 12 + k, c - r - 1 + k, 2 * r + 2 - 2 * k, 1, 2 * r + 2 - 2 * k, 0xd8382c);
  m.box(c - 1, 18, c - 1, 2, 3, 2, C.Dark).box(c - 2, 21, c - 2, 4, 1, 4, C.Hazard);
  return m;
}

/** A giant cheerful fish on a pole, on a flat roof's top (y = 2): the fish shop's sign. */
export function bigFish(m: Model, cx: number, cz: number, body: number, fin: number): Model {
  m.box(cx - 1, 2, cz - 1, 2, 6, 2, C.Steel);
  const y0 = 13;
  for (let x = -14; x < 14; x++)
    for (let y = -7; y < 7; y++) {
      const e = (x + 0.5) * (x + 0.5) / 196 + (y + 0.5) * (y + 0.5) / 42;
      if (e > 1) continue;
      const stripe = x % 6 === 0 && x < 8 && x > -10;
      for (let z = -2; z < 2; z++) m.set(cx + x, y0 + y, cz + z, y < -3 ? 0xfff4d6 : stripe ? fin : body);
    }
  // The tail, at -x, and a fin on top.
  for (let k = 0; k < 7; k++) m.box(cx - 15 - k, y0 - 1 - k, cz - 1, 1, 2 + 2 * k, 2, fin);
  for (let k = 0; k < 4; k++) m.box(cx - 4 + k, y0 + 6 + (3 - k), cz - 1, 6 - k, 1, 2, fin);
  // Eyes and a smile on both sides.
  for (const z of [cz - 3, cz + 2]) {
    m.box(cx + 7, y0 + 1, z, 3, 3, 1, C.White).set(cx + 8, y0 + 2, z, C.Black);
    m.box(cx + 10, y0 - 2, z, 2, 1, 1, 0xd8263a).set(cx + 12, y0 - 1, z, 0xd8263a);
  }
  return m;
}

/** A big friendly whale on the aquarium's flat roof (y = 2), its tail up and a spout of water. */
export function whale(m: Model, cx: number, cz: number): Model {
  const Blue = 0x3f7fd8, Belly = 0xdfeef8;
  for (let x = -16; x < 16; x++)
    for (let y = 0; y < 14; y++)
      for (let z = -7; z < 7; z++) {
        const e = ((x + 0.5) / 16) ** 2 + ((y - 6) / 7) ** 2 + ((z + 0.5) / 7) ** 2;
        if (e <= 1) m.set(cx + x, 2 + y, cz + z, y < 4 ? Belly : Blue);
      }
  // The tail, at -x, sweeping up into flukes.
  for (let k = 0; k < 8; k++) m.box(cx - 16 - k, 6 + k, cz - 2, 2, 3, 4, Blue);
  m.box(cx - 26, 13, cz - 7, 4, 2, 14, Blue);
  // A smile and eyes on both sides, and a spout from the top.
  for (const z of [cz - 7, cz + 6]) m.box(cx + 9, 9, z, 2, 2, 1, C.White).set(cx + 10, 9, z, C.Black).box(cx + 6, 5, z, 8, 1, 1, 0x23406e);
  for (const [x, y, z] of [[0, 16, 0], [-1, 18, 0], [1, 18, 0], [-2, 20, -1], [2, 20, 1], [0, 20, 0]]) m.box(cx + 4 + x, y, cz + z - 1, 2, 2, 2, 0x9fe3ff);
  return m;
}

// ---------------------------------------------------------------- dump truck (teal) and street sweeper (pink)

export const DumpPaint = 0x1fb5a8;

/**
 * The dump truck's chassis and cab, chunky like a toy: big wheels (two at the front, four at the
 * back), a dark chassis, mudguards, and a short cab up front with a big windscreen. The tipper bed
 * is its own piece and tips on its own.
 */
export function dumpTruckBody(): Model {
  const P = DumpPaint;
  const m = new Model();
  const wheel = (x0: number, z0: number) => {
    m.box(x0, 0, z0, 6, 6, 2, C.Rubber).clear(x0, 0, z0, 1, 1, 2).clear(x0 + 5, 0, z0, 1, 1, 2).clear(x0, 5, z0, 1, 1, 2).clear(x0 + 5, 5, z0, 1, 1, 2);
    const hub = z0 < 0 ? z0 : z0 + 1;
    m.box(x0 + 2, 2, hub, 2, 2, 1, C.Steel).set(x0 + 2, 3, hub, C.Gray);
  };
  for (const z of [-7, 5]) {
    wheel(5, z); // front
    wheel(-6, z); // back, twice
    wheel(-12, z);
  }
  m.box(-13, 3, -4, 25, 2, 8, C.Dark); // chassis
  for (const z of [-7, 5]) {
    // Mudguards over the wheels, in the truck's colour.
    m.box(4, 6, z, 8, 1, 2, P).box(-13, 6, z, 14, 1, 2, P);
  }
  // The cab: short and tall, a big windscreen, side windows, a step.
  m.box(5, 5, -5, 7, 7, 10, P);
  m.box(11, 7, -4, 1, 4, 8, C.Glass).box(6, 8, -5, 4, 3, 1, C.Glass).box(6, 8, 4, 4, 3, 1, C.Glass);
  cabRoof(m, 5, 12, -5, 7, 10, P);
  m.box(12, 3, -5, 1, 3, 10, C.Steel).set(12, 5, -5, C.Light).set(12, 5, 4, C.Light); // bumper and lights
  m.box(12, 6, -2, 1, 2, 4, C.Dark); // grille
  m.box(7, 4, -6, 3, 1, 1, C.Steel).box(7, 4, 5, 3, 1, 1, C.Steel); // steps
  return m;
}

/**
 * The tipper bed, hinged at its back bottom edge (pivot at the hinge: cell 0 along x): steel with
 * ribs down the sides in the truck's colour, a sloped back lip, and a guard that reaches out over
 * the cab's roof.
 */
export function dumpBed(): Model {
  const P = DumpPaint, Steel = 0xa3abb5, Dark = 0x7d8590;
  const m = new Model();
  m.box(0, 0, -6, 17, 1, 12, Dark); // floor
  m.box(0, 1, -6, 17, 6, 1, Steel).box(0, 1, 5, 17, 6, 1, Steel); // sides
  m.box(16, 1, -6, 1, 9, 12, Steel); // front wall
  m.box(16, 9, -6, 7, 1, 12, Steel).box(22, 8, -6, 1, 1, 12, Dark); // the guard over the cab
  for (let x = 1; x < 16; x += 4) m.box(x, 1, -7, 1, 6, 1, P).box(x, 1, 6, 1, 6, 1, P); // ribs
  m.box(0, 7, -7, 17, 1, 1, P).box(0, 7, 6, 17, 1, 1, P); // rims
  m.box(0, 1, -6, 1, 3, 12, C.Hazard).box(0, 4, -6, 1, 1, 12, C.Dark); // the low back edge
  return m;
}

/** A heap of dirt that sits in the bed: grows as it's loaded. Pivot at its bottom middle. */
export function bedDirt(): Model {
  const m = new Model();
  for (let x = -7; x < 7; x++)
    for (let z = -4; z < 4; z++) {
      const h = Math.max(1, Math.round(4 - (Math.abs(x + 0.5) / 7) * 2 - (Math.abs(z + 0.5) / 4) * 1.5));
      for (let y = 0; y < h; y++) m.set(x, y, z, y === h - 1 && (x + z) % 3 === 0 ? 0x86592f : C.Earth);
    }
  return m;
}

/** A skip by the gate for the dirt to go in: chunky yellow, sloped ends. Pivot at the bottom middle. */
export function skip(): Model {
  const m = new Model();
  m.box(-9, 0, -6, 18, 1, 12, C.Dark);
  for (let y = 1; y < 8; y++) {
    const s = Math.floor(y / 2);
    m.box(-9 - s, y, -6, 1, 1, 12, C.Hazard).box(8 + s, y, -6, 1, 1, 12, C.Hazard);
    m.box(-9 - s, y, -6, 18 + 2 * s, 1, 1, C.Hazard).box(-9 - s, y, 5, 18 + 2 * s, 1, 1, C.Hazard);
  }
  m.box(-13, 7, -6, 26, 1, 1, C.Dark).box(-13, 7, 5, 26, 1, 1, C.Dark);
  return m;
}

export const SweeperPaint = 0xff6fae;

/** The street sweeper: a little cab on four wheels, a water tank behind, a squeegee under. */
export function sweeperBody(): Model {
  const P = SweeperPaint;
  const m = new Model();
  for (const x0 of [3, -7]) for (const z0 of [-5, 4]) m.box(x0, 0, z0, 3, 3, 1, C.Rubber).set(x0 + 1, 1, z0, C.Gray);
  m.box(-8, 1, -4, 15, 3, 8, P);
  m.box(-8, 3, -4, 15, 1, 1, C.White).box(-8, 3, 3, 15, 1, 1, C.White);
  // The water tank behind the cab, white with a blue band.
  m.box(-8, 4, -4, 7, 5, 8, C.White).box(-8, 6, -4, 7, 1, 8, 0x4aa8ff);
  m.box(-8, 8, -4, 7, 1, 8, 0x4aa8ff).box(-7, 8, -3, 5, 1, 6, C.White).box(-6, 9, -1, 2, 1, 2, C.Dark); // its top, with a filler cap
  // The cab, glass all round.
  m.box(0, 4, -4, 6, 6, 8, P);
  m.box(5, 6, -3, 1, 3, 6, C.Glass).box(1, 6, -4, 4, 3, 1, C.Glass).box(1, 6, 3, 4, 3, 1, C.Glass);
  cabRoof(m, 0, 10, -4, 6, 8, P);
  // Arms out to the brushes at the front corners, and a squeegee under the middle.
  m.box(6, 1, -6, 3, 1, 1, C.Dark).box(6, 1, 5, 3, 1, 1, C.Dark);
  m.box(-6, 0, -5, 1, 1, 10, C.Dark);
  return m;
}

/** One round brush, flat, spinning about y: bristles in yellow and dark. */
export function sweeperBrush(): Model {
  const m = new Model();
  for (let x = -3; x < 3; x++)
    for (let z = -3; z < 3; z++) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d > 3.2) continue;
      m.set(x, 0, z, (Math.floor(Math.atan2(z + 0.5, x + 0.5) / (Math.PI / 3)) + 6) % 2 ? C.Hazard : C.Dark);
      if (d < 1.4) m.set(x, 1, z, C.Steel);
    }
  return m;
}

/**
 * A drift of pale beach sand blown over the site, `w` x `d` cells: a little heaped in the middle,
 * with wind ripples and the odd shell, so it stands out against the site's own sand.
 */
export function sandPatch(w: number, d: number, seed: number): Model {
  const m = new Model();
  for (let x = 0; x < w; x++)
    for (let z = 0; z < d; z++) {
      const ex = Math.abs(x - (w - 1) / 2) / (w / 2), ez = Math.abs(z - (d - 1) / 2) / (d / 2);
      const e = ex * ex + ez * ez;
      if (e > 1 || (e > 0.7 && (x * 7 + z * 3 + seed) % 3 === 0)) continue;
      const h = e < 0.3 ? 2 : 1;
      for (let y = 0; y < h; y++) m.set(x, y, z, (x + seed) % 3 === 0 ? 0xead7a8 : 0xfaf0d7);
    }
  m.set(Math.floor(w / 3), 2, Math.floor(d / 2), (seed % 2 ? 0xff9ec4 : 0xffffff)); // a shell
  return m;
}

// ---------------------------------------------------------------- town traffic

/** A little round car for the town's streets, facing +x: body in `paint`, white roof, big windows. */
export function car(paint: number, roof = C.White): Model {
  const m = new Model();
  for (const x0 of [3, -6]) for (const z0 of [-4, 3]) m.box(x0, 0, z0, 3, 3, 1, C.Rubber).set(x0 + 1, 1, z0, C.Gray);
  m.box(-8, 1, -3, 17, 3, 6, paint);
  bevelTop(m, -8, 3, -3, 17, 6);
  m.box(-5, 4, -3, 10, 3, 6, paint);
  m.box(-4, 4, -3, 8, 2, 6, C.Glass).box(-5, 4, -2, 10, 2, 4, C.Glass);
  cabRoof(m, -5, 7, -3, 10, 6, paint, roof);
  m.box(9, 2, -3, 1, 1, 1, C.Light).box(9, 2, 2, 1, 1, 1, C.Light); // headlights
  m.box(-9, 2, -3, 1, 1, 1, 0xd8263a).box(-9, 2, 2, 1, 1, 1, 0xd8263a); // tail lights
  return m;
}

/** A little town bus: long, yellow-and-white, a row of windows. Faces +x. */
export function bus(): Model {
  const m = new Model();
  const P = 0xffc93c;
  for (const x0 of [8, -12]) for (const z0 of [-5, 4]) m.box(x0, 0, z0, 4, 4, 1, C.Rubber).set(x0 + 1, 1, z0, C.Gray).set(x0 + 2, 2, z0, C.Gray);
  m.box(-15, 1, -4, 30, 5, 8, P);
  m.box(-15, 6, -4, 30, 4, 8, C.White);
  for (let x = -13; x < 12; x += 4) m.box(x, 6, -4, 3, 3, 8, C.Glass);
  m.box(13, 5, -3, 2, 4, 6, C.Glass);
  m.box(-15, 10, -4, 30, 1, 8, P);
  bevelTop(m, -15, 10, -4, 30, 8);
  m.box(15, 2, -4, 1, 1, 1, C.Light).box(15, 2, 3, 1, 1, 1, C.Light);
  m.box(-16, 2, -4, 1, 1, 1, 0xd8263a).box(-16, 2, 3, 1, 1, 1, 0xd8263a);
  return m;
}

// ---------------------------------------------------------------- the playground

const Rainbow = [0xff5d8f, 0xffc93c, 0x3fb950, 0x4aa8ff, 0xc77dff];

/**
 * A playground's fence panel instead of a wall: rainbow posts and white rails, about knee to waist
 * height on a small child, and on the front a wide open gap for the way in.
 */
function playFence(len: number, gate: boolean): Model {
  const m = new Model();
  const g0 = Math.floor(len / 2) - 6, g1 = g0 + 12;
  const open = (x: number) => gate && x >= g0 && x < g1;
  for (let x = 0; x < len; x++) {
    if (open(x)) continue;
    if (x % 4 === 0 || x === len - 1) m.box(x, 0, 0, 1, 9, 2, Rainbow[Math.floor(x / 4) % Rainbow.length]);
    m.box(x, 8, 0, 1, 1, 2, C.White).box(x, 4, 0, 1, 1, 2, C.White);
  }
  if (gate) for (const x of [g0 - 1, g1]) m.box(x, 0, 0, 1, 11, 2, C.White).box(x, 11, 0, 1, 1, 2, C.Hazard);
  return m;
}

/**
 * Everything to play on, as one piece the crane lifts in: a slide tower with a little roof and a
 * yellow slide, swings, a roundabout and a sandpit. Pivot it at [W/2, 0, D/2] for a `w` x `d` lot.
 */
export function playSet(w: number, d: number): Model {
  const m = new Model();
  const W = w * 10, D = d * 10;
  const cx = Math.round(W / 2), cz = Math.round(D / 2) - 4;
  // The tower: four posts, a deck, a little red roof, and a ladder at the back.
  for (const [x, z] of [[cx - 5, cz - 5], [cx + 4, cz - 5], [cx - 5, cz + 4], [cx + 4, cz + 4]]) m.box(x, 0, z, 1, 18, 1, 0x4aa8ff);
  m.box(cx - 5, 9, cz - 5, 10, 1, 10, 0x9a6a3c);
  for (let x = cx - 5; x < cx + 5; x += 2) m.box(x, 10, cz - 5, 1, 4, 1, C.White).box(x, 10, cz + 4, 1, 4, 1, C.White);
  for (let k = 0; k < 4; k++) m.box(cx - 6 + k, 18 + k, cz - 6 + k, 12 - 2 * k, 1, 12 - 2 * k, 0xd8382c);
  for (let y = 1; y < 9; y += 2) m.box(cx - 3, y, cz - 6, 6, 1, 1, C.Steel);
  // The slide, down to the front.
  for (let k = 0; k < 12; k++) {
    m.box(cx - 2, 9 - Math.round(k * 0.75), cz + 5 + k, 4, 1, 1, C.Hazard);
    m.box(cx - 3, 10 - Math.round(k * 0.75), cz + 5 + k, 1, 1, 1, 0xff8a1f).box(cx + 2, 10 - Math.round(k * 0.75), cz + 5 + k, 1, 1, 1, 0xff8a1f);
  }
  // Swings on the left: an A-frame each end, a bar across, two seats on chains.
  const sx = 4;
  for (const z of [cz - 7, cz + 7]) for (let y = 0; y < 15; y++) m.set(sx + Math.floor(y / 5), y, z, 0xff5d8f).set(sx + 8 - Math.floor(y / 5), y, z, 0xff5d8f);
  m.box(sx + 3, 15, cz - 7, 3, 1, 15, 0xff5d8f);
  for (const z of [cz - 3, cz + 3]) {
    for (let y = 5; y < 15; y++) m.set(sx + 4, y, z - 1, C.Steel).set(sx + 4, y, z + 1, C.Steel);
    m.box(sx + 3, 4, z - 1, 3, 1, 3, 0x3a3f47);
  }
  // A roundabout on the right.
  const rx = W - 9, rz = cz;
  for (let x = -5; x <= 5; x++)
    for (let z = -5; z <= 5; z++) {
      const dd = Math.hypot(x, z);
      if (dd <= 5) m.set(rx + x, 1, rz + z, Rainbow[(Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 2.5))) % Rainbow.length]);
    }
  m.box(rx, 0, rz, 1, 1, 1, C.Steel).box(rx, 2, rz, 1, 4, 1, C.Steel).box(rx - 3, 5, rz, 7, 1, 1, C.Steel).box(rx, 5, rz - 3, 1, 1, 7, C.Steel);
  // A sandpit at the front left, with a bucket and spade.
  const px = 6, pz = D - 12;
  m.box(px, 0, pz, 12, 2, 9, 0x9a6a3c).box(px + 1, 0, pz + 1, 10, 2, 7, 0xf0d9a0);
  m.box(px + 3, 2, pz + 3, 2, 2, 2, 0x4aa8ff).box(px + 7, 2, pz + 4, 1, 3, 1, 0xd8382c);
  // A bench at the front right for the grown-ups.
  m.box(W - 16, 0, D - 6, 1, 2, 3, C.Dark).box(W - 8, 0, D - 6, 1, 2, 3, C.Dark).box(W - 16, 2, D - 6, 9, 1, 3, C.Wood).box(W - 16, 3, D - 4, 9, 2, 1, C.Wood);
  return m;
}

// ---------------------------------------------------------------- the yard's forklift (lime)

export const ForkPaint = 0x9bd23a;

/** The forklift without its forks: small, a cage over the seat, a counterweight at the back, the mast at the front (+x). */
export function forkliftBody(): Model {
  const P = ForkPaint;
  const m = new Model();
  for (const x0 of [2, -5]) for (const z0 of [-4, 3]) m.box(x0, 0, z0, 3, 3, 1, C.Rubber).set(x0 + 1, 1, z0, C.Gray);
  m.box(-6, 1, -3, 11, 3, 6, P);
  bevelTop(m, -6, 3, -3, 11, 6);
  m.box(-7, 1, -3, 2, 5, 6, C.Dark); // counterweight
  m.box(-3, 4, -1, 3, 1, 3, C.Dark).box(-3, 5, -1, 1, 2, 3, C.Dark); // seat
  for (const [x, z] of [[-4, -3], [-4, 2], [2, -3], [2, 2]]) m.box(x, 4, z, 1, 7, 1, C.Dark); // the cage
  m.box(-4, 11, -3, 7, 1, 6, P);
  // The mast: two uprights at the front.
  m.box(5, 1, -3, 1, 14, 1, C.Steel).box(5, 1, 2, 1, 14, 1, C.Steel).box(5, 14, -3, 1, 1, 6, C.Steel);
  return m;
}

/** The forks on their carriage, which slides up the mast: two prongs out to +x. Pivot at the carriage foot. */
export function forkliftForks(): Model {
  const m = new Model();
  m.box(0, 0, -3, 1, 4, 6, C.Dark);
  m.box(1, 0, -2, 8, 1, 1, C.Steel).box(1, 0, 1, 8, 1, 1, C.Steel);
  return m;
}

// ---------------------------------------------------------------- floors and front gardens

/**
 * A floor deck between storeys, sitting inside the walls: warm floorboards on top, a concrete
 * edge. `w` x `d` tiles less the walls; pivot it at its bottom middle.
 */
export function floorDeck(w: number, d: number): Model {
  const m = new Model();
  const W = w * 10 - 4, D = d * 10 - 4;
  for (let x = 0; x < W; x++)
    for (let z = 0; z < D; z++) {
      const edge = x === 0 || z === 0 || x === W - 1 || z === D - 1;
      m.set(x, 0, z, edge ? C.Concrete : z % 3 === 0 ? 0xb87a34 : (x + Math.floor(z / 3) * 7) % 11 === 0 ? 0xa86c2e : 0xc98a3e);
    }
  return m;
}

/** A terracotta pot with a little flowering plant. */
export function pot(flower: number): Model {
  const m = new Model();
  m.box(-1, 0, -1, 3, 2, 3, 0xc0573f).box(-1, 2, -1, 3, 1, 3, 0xd8734f);
  m.box(-1, 3, -1, 3, 1, 3, 0x4fae4a).set(0, 4, 0, flower).set(-1, 4, 1, flower).set(1, 4, -1, flower);
  return m;
}

// ---------------------------------------------------------------- gardens and the edge of town

/** A garden shed: wooden walls, a little window, a dark pitched roof. Faces +z. Pivot at its bottom middle. */
export function shed(paint: number): Model {
  const m = new Model();
  m.box(-6, 0, -5, 12, 10, 10, paint);
  for (let x = -6; x < 6; x += 2) m.box(x, 0, 4, 1, 10, 1, C.Wood); // boards
  m.box(-2, 0, 5, 4, 8, 1, C.Wood).set(1, 4, 6, C.Hazard); // the door
  m.box(3, 5, 5, 2, 2, 1, C.Glass);
  for (let k = 0; k < 6; k++) m.box(-7, 10 + k, -6 + k, 14, 1, 12 - 2 * k, 0x4a4f57);
  return m;
}

/** A washing line between two posts, with bright washing pegged on it. Along x. */
export function washingLine(seed: number): Model {
  const m = new Model();
  m.box(0, 0, 0, 1, 14, 1, C.Wood).box(24, 0, 0, 1, 14, 1, C.Wood);
  m.box(0, 13, 0, 25, 1, 1, C.White);
  const cols = [0xff5d8f, 0x4aa8ff, 0xffc93c, 0x3fb950, 0xffffff, 0xc77dff];
  for (let x = 3; x < 22; x += 5) {
    const c = cols[(x + seed) % cols.length];
    const h = 4 + ((x * 3 + seed) % 3);
    m.box(x, 13 - h, 0, 3, h, 1, c);
  }
  return m;
}

/** A vegetable patch: rows of dark soil with green tops, a few orange carrots and red tomatoes. */
export function vegPatch(w: number, d: number): Model {
  const m = new Model();
  m.box(0, 0, 0, w, 1, d, 0x6b4a2b);
  for (let z = 1; z < d - 1; z += 3)
    for (let x = 1; x < w - 1; x += 2) {
      m.set(x, 1, z, 0x3f9440).set(x, 2, z, z % 2 ? 0x4fae4a : 0x3f9440);
      if ((x + z) % 5 === 0) m.set(x, 1, z + 1, 0xff8a1f);
      if ((x * 2 + z) % 7 === 0) m.set(x, 3, z, 0xd8263a);
    }
  return m;
}

/** A round trampoline on short legs, with a blue mat and a bright rim. Pivot at the middle. */
export function trampoline(): Model {
  const m = new Model();
  for (let x = -6; x < 6; x++)
    for (let z = -6; z < 6; z++) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d > 6) continue;
      m.set(x, 3, z, d > 5 ? 0x3fb950 : 0x2f74d0);
    }
  for (const [x, z] of [[-4, -4], [3, -4], [-4, 3], [3, 3]]) m.box(x, 0, z, 1, 3, 1, C.Dark);
  return m;
}

/** A trimmed hedge, `len` cells along x, about knee high on a grown-up. */
export function hedge(len: number): Model {
  const m = new Model();
  for (let x = 0; x < len; x++) m.box(x, 0, 0, 1, 4, 2, (x * 7) % 5 === 0 ? 0x4fae4a : 0x3f8f45).set(x, 4, (x % 3) % 2, 0x3f9a45);
  return m;
}

/** A red barn with white trim and big doors, for the farm at the edge of town. Faces +z. */
export function barn(): Model {
  const m = new Model();
  const Red = 0xc0392b;
  m.box(-14, 0, -10, 28, 16, 20, Red);
  m.box(-14, 0, 9, 28, 1, 1, C.White).box(-14, 15, 9, 28, 1, 1, C.White);
  m.box(-5, 0, 10, 10, 12, 1, C.White).box(-4, 1, 10, 8, 10, 1, 0xa83226);
  for (let k = 0; k < 4; k++) m.box(-4 + k, 1 + Math.round(k * 2.5), 10, 8 - 2 * k, 1, 1, C.White);
  for (let k = 0; k < 9; k++) m.box(-15, 16 + k, -11 + k, 30, 1, 22 - 2 * k, 0x7a3a2c);
  m.box(-2, 19, 11, 4, 4, 1, C.White).box(-1, 20, 12, 2, 2, 1, C.Dark); // the hayloft window
  return m;
}

/** A field in rows, `w` x `d` cells: brown furrows and green crops, a few with yellow flowers. */
export function field(w: number, d: number, crop: number): Model {
  const m = new Model();
  for (let x = 0; x < w; x++)
    for (let z = 0; z < d; z++) {
      if (z % 4 < 2) m.set(x, 0, z, 0x7a5233);
      else {
        m.set(x, 0, z, 0x6b4a2b).set(x, 1, z, (x * 3 + z) % 9 === 0 ? 0xffd34d : crop);
      }
    }
  return m;
}

/** A little green tractor with big back wheels. Faces +x. */
export function tractor(): Model {
  const m = new Model();
  const P = 0x3fa34d;
  for (const z of [-5, 4]) m.box(-6, 0, z, 6, 6, 1, C.Rubber).set(-4, 2, z, C.Hazard).set(-3, 3, z, C.Hazard);
  for (const z of [-4, 3]) m.box(3, 0, z, 3, 3, 1, C.Rubber);
  m.box(-6, 3, -3, 13, 3, 6, P).box(1, 6, -2, 6, 2, 4, P);
  m.box(-5, 6, -3, 5, 6, 6, C.Glass).box(-5, 12, -3, 5, 1, 6, P);
  m.box(7, 4, -2, 1, 2, 4, C.Dark).box(4, 8, 1, 1, 3, 1, C.Dark);
  return m;
}

// ---------------------------------------------------------------- the crew's yard

/** A stack of big pipes, lying along x, orange ends. Pivot at the bottom middle. */
export function pipeStack(): Model {
  const m = new Model();
  const pipe = (y0: number, z0: number) => {
    for (let y = 0; y < 4; y++)
      for (let z = 0; z < 4; z++) {
        if ((y === 0 || y === 3) && (z === 0 || z === 3)) continue;
        const inner = y > 0 && y < 3 && z > 0 && z < 3;
        m.box(0, y0 + y, z0 + z, 20, 1, 1, 0x9aa3ad);
        m.set(-1, y0 + y, z0 + z, inner ? 0x3a3f47 : 0xff8a1f).set(20, y0 + y, z0 + z, inner ? 0x3a3f47 : 0xff8a1f);
      }
  };
  for (const z of [-6, -2, 2]) pipe(0, z);
  for (const z of [-4, 0]) pipe(4, z);
  m.box(2, 0, -7, 2, 1, 14, C.Wood).box(16, 0, -7, 2, 1, 14, C.Wood);
  return m;
}

/** A pallet of bricks, wrapped neatly. Pivot at the bottom middle. */
export function bricks(): Model {
  const m = new Model();
  m.box(-6, 0, -6, 12, 1, 12, C.Wood);
  for (let y = 1; y < 7; y++)
    for (let x = -5; x < 5; x++)
      for (let z = -5; z < 5; z++) m.set(x, y, z, (x + y * 2 + (y % 2 ? 0 : 1)) % 3 === 0 ? 0xa8442f : 0xc0573f);
  return m;
}

/** A shipping container for the crew's tools: ribbed sides, big doors at one end. Along x. */
export function container(paint: number): Model {
  const m = new Model();
  m.box(0, 0, 0, 40, 16, 16, paint);
  for (let x = 1; x < 40; x += 2) m.box(x, 1, -1, 1, 14, 1, paint).box(x, 1, 16, 1, 14, 1, paint);
  m.box(0, 15, 0, 40, 1, 16, 0x3a3f47);
  m.box(40, 1, 1, 1, 14, 14, paint).box(40, 2, 7, 1, 12, 2, 0x3a3f47);
  for (const z of [3, 12]) m.box(41, 3, z, 1, 10, 1, C.Steel);
  return m;
}
