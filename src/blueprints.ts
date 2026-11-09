import * as THREE from "three";
import * as M from "./models";
import { C, Cell } from "./models";
import { Faces, voxelMaterial, type Model } from "./voxel";

/**
 * What can be built, as data: a footprint, how many storeys, each wall panel's paint and windows,
 * and a roof. Every building is made the same few ways (dig, pour, lift the walls, lift the roof,
 * roll the path), so a new kind of building is a new entry here, not new rules.
 *
 * Coordinates are relative to the middle of the footprint at ground level; the front is +z.
 */
export type Kind = "cottage" | "tall" | "shop" | "station" | "duplex" | "terrace" | "flats" | "corner" | "school" | "cafe" | "library" | "police" | "hall" | "lighthouse" | "fish" | "boathouse" | "aquarium" | "playground";

export interface RoofSpec {
  model: () => Model;
  pivot: [number, number, number];
  height: number; // world units, from its foot to its highest point
  slingTop: number; // pivot to where the slings meet it
  /** What the progress strip shows for it, and where the finishing flag goes. */
  look: "gable" | "cone" | "tower" | "garden" | "cup" | "book" | "lights" | "clock" | "lantern" | "fish" | "whale" | "play";
  tile?: number; // a gable's tile colour, for its picture
  /** It goes on the ground inside the walls (a playground's play set), not on top of them. */
  onGround?: boolean;
  /** Hook to the roof's pivot while it's carried, if not its height plus a bit (a flat roof hangs closer, so the crane reaches a third storey). */
  hang?: number;
}

export interface Blueprint {
  kind: Kind;
  w: number; // tiles across (x)
  d: number; // tiles deep (z)
  storeys: number;
  /** Per storey: back, right, left, front. */
  walls: M.PanelStyle[][];
  roof: RoofSpec;
  /** The colour the town's progress strip shows it in. */
  colour: number;
  /** How many households live here: a cottage is one, a block of flats six. */
  homes: number;
  /** What the slab sets to, if not concrete (a playground's soft green surface). */
  slab?: number;
  /** How the dirt heaps go at the end: the bulldozer pushes them away, or the dump truck hauls them to a skip. */
  finish?: "push" | "haul";
  /** Sand's blown in from the beach by the end, and the street sweeper sweeps it up. */
  sweep?: boolean;
}

export const SLAB_TOP = 0.1;
export const WALL_H = 1.4;
const T = 0.2; // wall thickness

export interface Slot {
  storey: number;
  side: "back" | "right" | "left" | "front";
  centre: THREE.Vector3; // middle of the panel, relative to the footprint's middle
  yaw: number;
  len: number; // cells
  style: M.PanelStyle;
}

/** Where each wall panel goes, storey by storey: back, right, left, front. */
export function slots(bp: Blueprint): Slot[] {
  const out: Slot[] = [];
  const hw = bp.w / 2, hd = bp.d / 2;
  for (let s = 0; s < bp.storeys; s++) {
    const y = SLAB_TOP + WALL_H * s + WALL_H / 2;
    const [back, right, left, front] = bp.walls[s];
    out.push(
      { storey: s, side: "back", len: bp.w * 10, yaw: 0, centre: new THREE.Vector3(0, y, -hd + T / 2), style: back },
      { storey: s, side: "right", len: bp.d * 10 - 4, yaw: Math.PI / 2, centre: new THREE.Vector3(hw - T / 2, y, 0), style: right },
      { storey: s, side: "left", len: bp.d * 10 - 4, yaw: Math.PI / 2, centre: new THREE.Vector3(-hw + T / 2, y, 0), style: left },
      { storey: s, side: "front", len: bp.w * 10, yaw: 0, centre: new THREE.Vector3(0, y, hd - T / 2), style: front },
    );
  }
  return out;
}

/** Where the roof sits, relative to the footprint's middle. */
export function roofAt(bp: Blueprint): THREE.Vector3 {
  return new THREE.Vector3(0, bp.roof.onGround ? SLAB_TOP : SLAB_TOP + WALL_H * bp.storeys, 0);
}

export function panelMesh(s: Slot): THREE.Mesh {
  return M.wallPanel(s.len, s.style).mesh(Cell, [s.len / 2, 7, 1]);
}

export function roofMesh(bp: Blueprint): THREE.Mesh {
  return bp.roof.model().mesh(Cell, bp.roof.pivot);
}

/** The whole building, finished, as one group with its foot at y = 0 (for the town). */
export function assemble(bp: Blueprint): THREE.Group {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(bp.w, SLAB_TOP + 0.02, bp.d),
    new THREE.MeshLambertMaterial({ color: bp.slab ?? C.Concrete }),
  );
  slab.position.y = (SLAB_TOP - 0.02) / 2;
  slab.receiveShadow = true;
  g.add(slab);
  for (const s of slots(bp)) {
    const m = panelMesh(s);
    m.position.copy(s.centre);
    m.rotation.y = s.yaw;
    g.add(m);
  }
  for (let s = 1; s < bp.storeys; s++) {
    const f = floorMesh(bp);
    f.position.copy(floorAt(bp, s));
    g.add(f);
  }
  const r = roofMesh(bp);
  r.position.copy(roofAt(bp));
  g.add(r);
  g.add(ramps(bp));
  g.add(frontWalk(bp));
  return g;
}

/** Where the floor between storey `s - 1` and storey `s` goes: its bottom, inside the walls. */
export function floorAt(_bp: Blueprint, s: number): THREE.Vector3 {
  return new THREE.Vector3(0, SLAB_TOP + WALL_H * s - 0.1, 0);
}

export function floorMesh(bp: Blueprint): THREE.Mesh {
  return M.floorDeck(bp.w, bp.d).mesh(Cell, [(bp.w * 10 - 4) / 2, 0, (bp.d * 10 - 4) / 2]);
}

/**
 * The front walk: when the doors are spread along the front (a terrace, a duplex), a paved walk
 * runs along the house from the foot of every door's ramp to the path, edged with flowers, with a
 * pot of flowers either side of each ramp. Laid out from the footprint's middle at ground level.
 */
export function frontWalk(bp: Blueprint): THREE.Group {
  const g = new THREE.Group();
  const doors = frontDoors(bp);
  const PATH_HALF = 0.75;
  const x0 = Math.min(-PATH_HALF, ...doors.map((x) => x - 0.45));
  const x1 = Math.max(PATH_HALF, ...doors.map((x) => x + 0.45));
  const flowers = [0xff5d8f, 0xffc93c, 0xffffff, 0xc77dff];
  doors.forEach((x, k) => {
    for (const dx of [-0.55, 0.55]) {
      const p = M.pot(flowers[(k * 2 + (dx > 0 ? 1 : 0)) % flowers.length]).mesh(Cell, [0, 0, 0]);
      p.position.set(x + dx, 0, bp.d / 2 + 0.5);
      g.add(p);
    }
  });
  if (x0 >= -PATH_HALF - 0.01 && x1 <= PATH_HALF + 0.01) return g; // the path's enough
  const z0 = bp.d / 2 + 0.7, z1 = z0 + 0.55;
  const f = new Faces();
  for (let x = x0; x < x1 - 0.01; x += 0.5) {
    const w = Math.min(0.5, x1 - x);
    f.box(x, 0, z0, w, 0.03, z1 - z0, 0x8d939a, (n) => n[1] === 1);
    f.box(x + 0.03, 0.031, z0 + 0.03, w - 0.06, 0, z1 - z0 - 0.06, 0xc3c7cc, (n) => n[1] === 1);
  }
  const walk = new THREE.Mesh(f.geometry(), voxelMaterial);
  walk.receiveShadow = true;
  g.add(walk);
  // Flowers along its outer edge, leaving the path to the gate open.
  for (const [a, b] of [[x0, -PATH_HALF], [PATH_HALF, x1]]) {
    const n = Math.round((b - a) * 10);
    if (n < 4) continue;
    const fl = M.flowers(n, Math.round(a * 7)).mesh(Cell, [0, 0, 0]);
    fl.position.set(a, 0, z1);
    g.add(fl);
  }
  return g;
}

// ------------------------------------------------------------------ the kinds

const Pastel = { mint: 0x9ad9b5, peach: 0xffb4a0, lilac: 0xb9a6e6, sky: 0x8fc8f0, butter: 0xf6dc7a, pink: 0xf7b6c8, cream: 0xf3e6c8 };
const RedTiles: M.RoofColours = { tile: 0xd2513a, tile2: 0xc2462f, under: 0xb84a33, gable: 0xf3e6c8 };
const SlateTiles: M.RoofColours = { tile: 0x5b7db8, tile2: 0x4e6ea6, under: 0x45608f, gable: 0xf3e6c8 };
const GreenTiles: M.RoofColours = { tile: 0x4f9d58, tile2: 0x45894d, under: 0x3c7a44, gable: 0xf3e6c8 };

function gable(w: number, d: number, c: M.RoofColours): RoofSpec {
  const W = w * 10 + 4, D = d * 10 + 4;
  const h = M.gableHeight(d) * Cell;
  return { model: () => M.gableRoof(w, d, c), pivot: [W / 2, 0, D / 2], height: Math.max(h, 1.2), slingTop: h * 0.9, look: "gable", tile: c.tile };
}

export function cottage(paints: [number, number, number, number], tiles: M.RoofColours): Blueprint {
  const [back, right, left, front] = paints;
  return {
    kind: "cottage", w: 4, d: 4, storeys: 1, colour: front, homes: 1,
    walls: [[
      { paint: back, windows: [10, 30] },
      { paint: right, windows: [18] },
      { paint: left, windows: [18] },
      { paint: front, windows: [7, 33], door: true },
    ]],
    roof: gable(4, 4, tiles),
  };
}

export function tall(paint: number, tiles: M.RoofColours): Blueprint {
  return {
    kind: "tall", w: 4, d: 4, storeys: 2, colour: paint, homes: 1,
    walls: [
      [
        { paint, windows: [10, 30] },
        { paint, windows: [18] },
        { paint, windows: [18] },
        { paint, windows: [7, 33], door: true, doorPaint: 0x2f74d0 },
      ],
      [
        { paint, windows: [20], upper: true },
        { paint, windows: [18], upper: true },
        { paint, windows: [18], upper: true },
        { paint, windows: [10, 30], upper: true },
      ],
    ],
    roof: gable(4, 4, tiles),
  };
}

export function shop(paint: number, awning: [number, number], scoops: [number, number]): Blueprint {
  const w = 5, d = 4;
  const W = w * 10 + 2, D = d * 10 + 2;
  return {
    kind: "shop", w, d, storeys: 1, colour: paint, homes: 0,
    walls: [[
      { paint, windows: [12, 38] },
      { paint, windows: [18] },
      { paint, windows: [18] },
      { paint, windows: [], shopWindow: [4, 30], doorAt: 36, doorPaint: 0xffffff, awning },
    ]],
    roof: {
      model: () => M.iceCream(M.flatRoof(w, d, Pastel.cream, C.White), Math.round(W / 2), Math.round(D / 2), scoops[0], scoops[1]),
      pivot: [W / 2, 0, D / 2],
      height: 2.9,
      slingTop: 0.25,
      look: "cone",
    },
  };
}

export function station(): Blueprint {
  const w = 5, d = 4;
  const W = w * 10 + 2, D = d * 10 + 2;
  const Brick = 0xc0573f;
  return {
    kind: "station", w, d, storeys: 1, colour: 0xd8382c, homes: 0,
    walls: [[
      { paint: Brick, windows: [12, 25, 38] },
      { paint: Brick, windows: [18] },
      { paint: Brick, windows: [18] },
      { paint: Brick, windows: [43], garage: [4, 30], doorAt: 33, doorPaint: 0xd8382c },
    ]],
    roof: {
      model: () => M.bellTower(M.flatRoof(w, d, 0x9aa0a6, C.White), W - 14, 4),
      pivot: [W / 2, 0, D / 2],
      height: 2.0,
      slingTop: 0.25,
      look: "tower",
    },
  };
}

// ------------------------------------------------------------------ homes for everyone

/** Two homes side by side under one roof: each half its own colour and front door, two storeys. */
export function duplex(a: number, b: number, doorA: number, doorB: number, tiles: M.RoofColours): Blueprint {
  const w = 5, d = 4, L = w * 10;
  const bands = [{ from: 0, to: L / 2, paint: a }, { from: L / 2, to: L, paint: b }];
  return {
    kind: "duplex", w, d, storeys: 2, colour: a, homes: 2,
    walls: [
      [
        { paint: a, windows: [12, 38], bands },
        { paint: b, windows: [18] },
        { paint: a, windows: [18] },
        { paint: a, windows: [7, 43], bands, doors: [{ at: 14, paint: doorA }, { at: 30, paint: doorB }] },
      ],
      [
        { paint: a, windows: [12, 38], upper: true, bands },
        { paint: b, windows: [18], upper: true },
        { paint: a, windows: [18], upper: true },
        { paint: a, windows: [12, 38], upper: true, bands },
      ],
    ],
    roof: gable(w, d, tiles),
  };
}

/** A row of three terraced homes, each its own colour and door, two storeys, under one long roof. */
export function terrace(paints: [number, number, number], doors: [number, number, number], tiles: M.RoofColours): Blueprint {
  const w = 6, d = 4;
  const bands = paints.map((paint, k) => ({ from: k * 20, to: (k + 1) * 20, paint }));
  return {
    kind: "terrace", w, d, storeys: 2, colour: paints[1], homes: 3,
    walls: [
      [
        { paint: paints[0], windows: [10, 30, 50], bands },
        { paint: paints[2], windows: [18] },
        { paint: paints[0], windows: [18] },
        { paint: paints[0], windows: [14, 34, 54], bands, doors: doors.map((paint, k) => ({ at: k * 20 + 2, paint })) },
      ],
      [
        { paint: paints[0], windows: [10, 30, 50], upper: true, bands },
        { paint: paints[2], windows: [18], upper: true },
        { paint: paints[0], windows: [18], upper: true },
        { paint: paints[0], windows: [10, 30, 50], upper: true, bands },
      ],
    ],
    roof: gable(w, d, tiles),
  };
}

/** A small block of flats: three storeys, balconies at the front, a garden on the flat roof. */
export function flats(paint: number, trim: number): Blueprint {
  const w = 5, d = 4;
  const W = w * 10 + 2, D = d * 10 + 2;
  const front = (upper: boolean): M.PanelStyle =>
    upper ? { paint, trim, windows: [], balconies: [12, 38], upper: true } : { paint, trim, windows: [9, 41], doors: [{ at: 22, paint: 0x2f74d0 }] };
  const plain = (upper: boolean, windows: number[]): M.PanelStyle => ({ paint, trim, windows, upper });
  return {
    kind: "flats", w, d, storeys: 3, colour: paint, homes: 6,
    walls: [0, 1, 2].map((s) => [plain(s > 0, [12, 25, 38]), plain(s > 0, [10, 26]), plain(s > 0, [10, 26]), front(s > 0)]),
    roof: {
      model: () => M.roofGarden(M.flatRoof(w, d, 0xc9cbcc, trim), w, d),
      pivot: [W / 2, 0, D / 2],
      height: 1.4,
      slingTop: 0.25,
      hang: 1.0,
      look: "garden",
    },
  };
}

/** Homes over a shop: a bakery downstairs with its awning, two flats upstairs with balconies. */
export function corner(paint: number, awning: [number, number], tiles: M.RoofColours): Blueprint {
  const w = 5, d = 4;
  return {
    kind: "corner", w, d, storeys: 2, colour: paint, homes: 2,
    walls: [
      [
        { paint, windows: [12, 38] },
        { paint, windows: [18] },
        { paint, windows: [18] },
        { paint, windows: [], shopWindow: [4, 30], doorAt: 36, doorPaint: 0xffffff, awning },
      ],
      [
        { paint, windows: [25], upper: true },
        { paint, windows: [18], upper: true },
        { paint, windows: [18], upper: true },
        { paint, windows: [], balconies: [13, 37], upper: true },
      ],
    ],
    roof: gable(w, d, tiles),
  };
}

/** Where the front doors are along the front wall, in world units from the footprint's middle (x). */
export function frontDoors(bp: Blueprint): number[] {
  const s = bp.walls[0][3];
  const len = bp.w * 10;
  const out: number[] = [];
  if (s.door || s.doorAt !== undefined) out.push(s.doorAt ?? Math.floor(len / 2) - 3);
  for (const d of s.doors ?? []) out.push(d.at);
  return out.map((at) => (at + 3 - len / 2) * Cell);
}

/**
 * A gentle ramp up to each front door, with a handrail either side, so every door's step-free.
 * Laid out from the footprint's middle at ground level.
 */
export function ramps(bp: Blueprint): THREE.Group {
  const g = new THREE.Group();
  const rise = SLAB_TOP + 0.1, run = 0.7;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(run, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const mat = new THREE.MeshLambertMaterial({ color: C.Concrete });
  const rail = new THREE.MeshLambertMaterial({ color: C.White });
  const post = new THREE.BoxGeometry(0.04, 0.3, 0.04);
  const barLen = Math.hypot(run, rise);
  const bar = new THREE.BoxGeometry(barLen, 0.04, 0.04);
  // Doors side by side (double doors) share one wider ramp.
  const spans: [number, number][] = [];
  for (const x of frontDoors(bp).sort((p, q) => p - q)) {
    const last = spans[spans.length - 1];
    if (last && x - last[1] < 0.8) last[1] = x;
    else spans.push([x, x]);
  }
  for (const [x0, x1] of spans) {
    const x = (x0 + x1) / 2;
    const width = 0.7 + (x1 - x0);
    const wedge = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    wedge.translate(0, 0, -width / 2);
    const r = new THREE.Group();
    const m = new THREE.Mesh(wedge, mat);
    m.castShadow = m.receiveShadow = true;
    r.add(m);
    for (const z of [-width / 2 + 0.03, width / 2 - 0.03]) {
      for (const t of [0.06, run - 0.05]) {
        const p = new THREE.Mesh(post, rail);
        p.position.set(t, rise * (1 - t / run) + 0.15, z);
        r.add(p);
      }
      const b = new THREE.Mesh(bar, rail);
      b.position.set(run / 2, rise / 2 + 0.3, z);
      b.rotation.z = -Math.atan2(rise, run);
      r.add(b);
    }
    // Running out from the door (+z) down to the path.
    r.rotation.y = -Math.PI / 2;
    r.position.set(x, 0, bp.d / 2);
    g.add(r);
  }
  return g;
}

/** Home Street: the first neighbourhood's eight lots. */
const HOME_STREET: Blueprint[] = [
  cottage([Pastel.mint, Pastel.peach, Pastel.lilac, Pastel.sky], RedTiles),
  shop(Pastel.pink, [0x6fd3b0, 0xffffff], [0xff9ec4, 0x8be0c0]),
  duplex(Pastel.butter, Pastel.sky, 0x2f74d0, 0xd8382c, SlateTiles),
  station(),
  terrace([Pastel.mint, Pastel.peach, Pastel.lilac], [0xd8382c, 0x2f74d0, 0x3fb950], RedTiles),
  flats(Pastel.sky, C.White),
  corner(0xf9d7a0, [0xb87a34, 0xfff4d6], GreenTiles),
  tall(Pastel.lilac, RedTiles),
];


// ------------------------------------------------------------------ Market Square

/** The school: wide, two storeys, sunny yellow, double doors and a bell cupola on the ridge. */
export function school(): Blueprint {
  const w = 6, d = 4, paint = 0xf6cf6a;
  const W = w * 10 + 4, D = d * 10 + 4;
  const h = M.gableHeight(d);
  const tiles: M.RoofColours = { tile: 0xd2513a, tile2: 0xc2462f, under: 0xb84a33, gable: C.White };
  return {
    kind: "school", w, d, storeys: 2, colour: paint, homes: 0,
    walls: [
      [
        { paint, windows: [8, 20, 40, 52] },
        { paint, windows: [10, 26] },
        { paint, windows: [10, 26] },
        { paint, windows: [8, 18, 42, 52], doors: [{ at: 24, paint: 0x2f74d0 }, { at: 30, paint: 0x2f74d0 }] },
      ],
      [
        { paint, windows: [8, 20, 40, 52], upper: true },
        { paint, windows: [10, 26], upper: true },
        { paint, windows: [10, 26], upper: true },
        { paint, windows: [8, 20, 30, 40, 52], upper: true },
      ],
    ],
    roof: {
      model: () => M.cupola(M.gableRoof(w, d, tiles, false), W / 2, h - 1, D / 2),
      pivot: [W / 2, 0, D / 2],
      height: (h + 12) * Cell,
      slingTop: h * Cell * 0.9,
      hang: h * Cell + 1.2,
      look: "gable",
      tile: tiles.tile,
    },
  };
}

/** The café: a little corner café with a big window, a striped awning and a giant coffee cup on top. */
export function cafe(paint: number, awning: [number, number], cup: number): Blueprint {
  const w = 4, d = 4;
  const W = w * 10 + 2, D = d * 10 + 2;
  return {
    kind: "cafe", w, d, storeys: 1, colour: paint, homes: 0,
    walls: [[
      { paint, windows: [10, 30] },
      { paint, windows: [18] },
      { paint, windows: [18] },
      { paint, windows: [], shopWindow: [4, 22], doorAt: 28, doorPaint: 0xffffff, awning },
    ]],
    roof: {
      model: () => M.coffeeCup(M.flatRoof(w, d, 0xc9cbcc, C.White), Math.round(W / 2), Math.round(D / 2), cup),
      pivot: [W / 2, 0, D / 2],
      height: 2.0,
      slingTop: 0.25,
      look: "cup",
    },
  };
}

/** The library: cream stone with white columns at the front, and a giant open book on the roof. */
export function library(): Blueprint {
  const w = 5, d = 4, paint = 0xefe2c4;
  const W = w * 10 + 2, D = d * 10 + 2;
  return {
    kind: "library", w, d, storeys: 1, colour: 0x7a4fd6, homes: 0,
    walls: [[
      { paint, windows: [12, 25, 38] },
      { paint, windows: [10, 26] },
      { paint, windows: [10, 26] },
      { paint, windows: [10, 40], doorAt: 22, doorPaint: 0x7a4fd6, columns: [4, 17, 31, 44] },
    ]],
    roof: {
      model: () => M.openBook(M.flatRoof(w, d, 0xc9cbcc, C.White), Math.round(W / 2), Math.round(D / 2), 0x7a4fd6),
      pivot: [W / 2, 0, D / 2],
      height: 1.0,
      slingTop: 0.25,
      look: "book",
    },
  };
}

/** The police station: blue with white trim, a light bar on the flat roof. */
export function police(): Blueprint {
  const w = 5, d = 4, paint = 0x6f93cf;
  const W = w * 10 + 2, D = d * 10 + 2;
  return {
    kind: "police", w, d, storeys: 1, colour: 0x2f74d0, homes: 0,
    walls: [[
      { paint, windows: [12, 25, 38] },
      { paint, windows: [18] },
      { paint, windows: [18] },
      { paint, windows: [9, 41], doorAt: 22, doorPaint: 0x23406e },
    ]],
    roof: {
      model: () => M.lightBar(M.flatRoof(w, d, 0xc9cbcc, C.White), Math.round(W / 2), Math.round(D / 2)),
      pivot: [W / 2, 0, D / 2],
      height: 0.6,
      slingTop: 0.25,
      look: "lights",
    },
  };
}

/** The town hall: stone, two storeys, and a clock tower at one end of its roof. The square's landmark. */
export function townHall(): Blueprint {
  const w = 5, d = 4, paint = 0xe6dccb;
  const W = w * 10 + 4, D = d * 10 + 4;
  const h = M.gableHeight(d);
  const tiles: M.RoofColours = { tile: 0x5b7db8, tile2: 0x4e6ea6, under: 0x45608f, gable: 0xe6dccb };
  return {
    kind: "hall", w, d, storeys: 2, colour: 0x5b7db8, homes: 0,
    walls: [
      [
        { paint, windows: [10, 25, 40] },
        { paint, windows: [10, 26] },
        { paint, windows: [10, 26] },
        { paint, windows: [8, 42], doors: [{ at: 19, paint: 0x9a6a3c }, { at: 25, paint: 0x9a6a3c }], columns: [15, 33] },
      ],
      [
        { paint, windows: [10, 25, 40], upper: true },
        { paint, windows: [10, 26], upper: true },
        { paint, windows: [10, 26], upper: true },
        { paint, windows: [10, 40], balconies: [25], upper: true },
      ],
    ],
    roof: {
      // The tower stands at the east end, so the crane's slings in the middle stay clear of it.
      model: () => M.clockTower(M.gableRoof(w, d, tiles, false), W - 10, D / 2, 0, 0xc0573f),
      pivot: [W / 2, 0, D / 2],
      height: 3.3,
      slingTop: h * Cell * 0.9,
      hang: h * Cell + 1.2,
      look: "clock",
    },
  };
}

/**
 * A playground, built the same way as everything else: dig, pour a soft green surface, the crane
 * lifts in a rainbow fence (a way in at the front, no door to open), then the whole play set (a
 * slide tower, swings, a roundabout, a sandpit), and the path. Somewhere for everyone on the street.
 */
export function playground(): Blueprint {
  const w = 5, d = 4;
  const fence = (gate: boolean): M.PanelStyle => ({ paint: C.White, windows: [], fence: { gate } });
  return {
    kind: "playground", w, d, storeys: 1, colour: 0x3fb950, homes: 0, slab: 0x7fc98a,
    walls: [[fence(false), fence(false), fence(false), fence(true)]],
    roof: {
      model: () => M.playSet(w, d),
      pivot: [w * 5, 0, d * 5],
      height: 2.2,
      slingTop: 2.05,
      onGround: true,
      look: "play",
    },
  };
}

const MARKET_SQUARE: Blueprint[] = [
  school(),
  cafe(0x6fd3b0, [0x8a5a3c, 0xfff4d6], 0xff5d8f),
  terrace([Pastel.sky, Pastel.butter, Pastel.pink], [0x3fb950, 0xd8382c, 0x2f74d0], SlateTiles),
  library(),
  police(),
  flats(Pastel.peach, C.White),
  playground(),
  townHall(),
];


// ------------------------------------------------------------------ the Harbour

/**
 * The lighthouse: a narrow tower the crane builds floor by floor, red and white storeys, with the
 * lantern on top. The Harbour's landmark.
 */
export function lighthouse(): Blueprint {
  const w = 3, d = 3;
  const Red = 0xd8382c, White = 0xf6f4ef;
  const storey = (s: number): M.PanelStyle[] => {
    const paint = s % 2 ? White : Red;
    const trim = s % 2 ? Red : White;
    const upper = s > 0;
    return [
      { paint, trim, windows: s === 1 ? [15] : [], upper },
      { paint, trim, windows: s === 2 ? [13] : [], upper },
      { paint, trim, windows: s === 2 ? [13] : [], upper },
      s === 0 ? { paint, trim, windows: [], doorAt: 12, doorPaint: 0x23406e } : { paint, trim, windows: [15], upper },
    ];
  };
  return {
    kind: "lighthouse", w, d, storeys: 3, colour: Red, homes: 0,
    walls: [0, 1, 2].map(storey),
    roof: {
      model: () => M.lantern(w),
      pivot: [(w * 10 + 2) / 2, 0, (d * 10 + 2) / 2],
      height: 2.2,
      slingTop: 0.3,
      hang: 1.1,
      look: "lantern",
    },
  };
}

/** The fish shop: sea-blue with a big window, a striped awning and a giant fish on top. */
export function fishShop(): Blueprint {
  const w = 4, d = 4, paint = 0x8fd3e8;
  const W = w * 10 + 2, D = d * 10 + 2;
  return {
    kind: "fish", w, d, storeys: 1, colour: 0xff8a1f, homes: 0,
    walls: [[
      { paint, windows: [10, 30] },
      { paint, windows: [18] },
      { paint, windows: [18] },
      { paint, windows: [], shopWindow: [4, 22], doorAt: 28, doorPaint: 0xffffff, awning: [0x2f74d0, 0xffffff] },
    ]],
    roof: {
      model: () => M.bigFish(M.flatRoof(w, d, 0xc9cbcc, C.White), Math.round(W / 2), Math.round(D / 2), 0xff8a1f, 0xffc93c),
      pivot: [W / 2, 0, D / 2],
      height: 2.0,
      slingTop: 0.25,
      look: "fish",
    },
  };
}

/** The boathouse: white boards, a wide blue-and-white boat door onto the street, a gable roof. */
export function boathouse(): Blueprint {
  const w = 5, d = 4, paint = 0xf6f4ef;
  const tiles: M.RoofColours = { tile: 0x2f74d0, tile2: 0x2766b8, under: 0x23406e, gable: 0xf6f4ef };
  return {
    kind: "boathouse", w, d, storeys: 1, colour: 0x2f74d0, homes: 0,
    walls: [[
      { paint, windows: [12, 38] },
      { paint, windows: [18] },
      { paint, windows: [18] },
      { paint, windows: [44], garage: [4, 36], garagePaint: [0x4aa8ff, 0xffffff], doorAt: 39, doorPaint: 0x2f74d0 },
    ]],
    roof: gable(w, d, tiles),
  };
}

/** The aquarium: long and low, sea-green, round porthole-ish windows, and a whale on the roof. */
export function aquarium(): Blueprint {
  const w = 6, d = 4, paint = 0x6fd3c8;
  const W = w * 10 + 2, D = d * 10 + 2;
  return {
    kind: "aquarium", w, d, storeys: 1, colour: 0x3f7fd8, homes: 0,
    walls: [[
      { paint, windows: [10, 30, 50] },
      { paint, windows: [10, 26] },
      { paint, windows: [10, 26] },
      { paint, windows: [], shopWindow: [4, 24], doors: [{ at: 27, paint: 0x3f7fd8 }], awning: [0x3f7fd8, 0xffffff] },
    ]],
    roof: {
      model: () => M.whale(M.flatRoof(w, d, 0xc9cbcc, C.White), Math.round(W / 2) + 4, Math.round(D / 2)),
      pivot: [W / 2, 0, D / 2],
      height: 2.2,
      slingTop: 0.25,
      hang: 1.3,
      look: "whale",
    },
  };
}

const Seaside = { coral: 0xffa48c, aqua: 0x8fe0d8, butter: 0xf6dc7a, white: 0xf6f4ef, navy: 0x23406e };

const HARBOUR: Blueprint[] = [
  fishShop(),
  boathouse(),
  terrace([Seaside.coral, Seaside.aqua, Seaside.butter], [0x2f74d0, 0xd8382c, 0x3fb950], SlateTiles),
  aquarium(),
  cottage([Seaside.white, Seaside.white, Seaside.white, Seaside.white], SlateTiles),
  flats(Seaside.white, 0x2f74d0),
  duplex(Seaside.aqua, Seaside.coral, 0xffc93c, 0x2f74d0, RedTiles),
  lighthouse(),
];

export interface Hood {
  /** The square or park in the middle of it. */
  theme: "park" | "square" | "harbour";
  lots: Blueprint[];
  /** What the gate's sign shows to say "this way to here": one of its buildings, in miniature. */
  landmark: Blueprint;
}

/** The neighbourhoods, in the order they open: finish one and the gate to the next swings open. */
export const HOODS: Hood[] = [
  { theme: "park", lots: HOME_STREET, landmark: HOME_STREET[0] },
  { theme: "square", lots: MARKET_SQUARE.map((bp) => ({ ...bp, finish: "haul" as const })), landmark: MARKET_SQUARE[7] },
  { theme: "harbour", lots: HARBOUR.map((bp, i) => ({ ...bp, finish: i % 2 ? ("haul" as const) : ("push" as const), sweep: true })), landmark: HARBOUR[7] },
];

// ------------------------------------------------------------------ picking colours

/**
 * The paint a home can be done in, picked by picture before the crane lifts the walls: the first
 * choice is always the building's own colours; these are the others. Each is three colours, so a
 * terrace's three homes (or a duplex's two) each get one.
 */
export const WALL_PALETTES: number[][] = [
  [0xf7b6c8, 0xf6dc7a, 0x9ad9b5], // pink, butter, mint
  [0x8fc8f0, 0xb9a6e6, 0xffb4a0], // sky, lilac, peach
  [0xffa48c, 0x8fe0d8, 0xf3e6c8], // coral, aqua, cream
];
const PurpleTiles: M.RoofColours = { tile: 0x7a5cc4, tile2: 0x6a4fb0, under: 0x5a4398, gable: 0xf3e6c8 };
/** The other roofs to pick from (the first choice is the building's own). */
export const ROOF_CHOICES: M.RoofColours[] = [RedTiles, GreenTiles, PurpleTiles];

/** Homes get to pick their paint; the shops and landmarks keep theirs. */
export function canPickWalls(bp: Blueprint): boolean {
  return bp.homes > 0;
}
/** ...and a home with a pitched roof picks its tiles too. */
export function canPickRoof(bp: Blueprint): boolean {
  return bp.homes > 0 && bp.roof.look === "gable";
}

/** The building's own wall colours, in the order they first appear (the main one first). */
export function paintsOf(bp: Blueprint): number[] {
  const out: number[] = [];
  const add = (c: number) => {
    if (!out.includes(c)) out.push(c);
  };
  for (const storey of bp.walls)
    for (const s of [storey[3], storey[0], storey[1], storey[2]]) {
      for (const b of s.bands ?? []) add(b.paint);
      add(s.paint);
    }
  return out;
}

/** `choice`: [walls, roof], each 0 for the building's own or 1.. for the lists above. */
export type Looks = [number, number];

/** The building done in the picked colours. */
export function recolour(bp: Blueprint, looks: Looks | undefined): Blueprint {
  if (!looks) return bp;
  const [wc, rc] = looks;
  let out = bp;
  if (wc > 0 && canPickWalls(bp) && WALL_PALETTES[wc - 1]) {
    const pal = WALL_PALETTES[wc - 1];
    const own = paintsOf(bp);
    const map = (c: number) => {
      const k = own.indexOf(c);
      return k < 0 ? c : pal[k % pal.length];
    };
    out = {
      ...out,
      colour: map(bp.colour),
      walls: bp.walls.map((storey) => storey.map((s) => ({ ...s, paint: map(s.paint), bands: s.bands?.map((b) => ({ ...b, paint: map(b.paint) })) }))),
    };
  }
  if (rc > 0 && canPickRoof(bp) && ROOF_CHOICES[rc - 1]) out = { ...out, roof: gable(bp.w, bp.d, ROOF_CHOICES[rc - 1]) };
  return out;
}

const hexc = (c: number) => "#" + c.toString(16).padStart(6, "0");

/** A wall choice's picture: a little house front striped in its colours. */
export function wallSwatch(bp: Blueprint, choice: number): string {
  const cols = choice === 0 ? paintsOf(bp).slice(0, 3) : WALL_PALETTES[choice - 1].slice(0, Math.max(1, Math.min(3, paintsOf(bp).length)));
  const w = 40 / cols.length;
  const stripes = cols.map((c, k) => `<rect x="${10 + k * w}" y="30" width="${w}" height="30" fill="${hexc(c)}"/>`).join("");
  return `<svg viewBox="0 0 60 66"><path d="M6 32L30 10l24 22z" fill="#c9cbcc"/>${stripes}<rect x="26" y="44" width="8" height="16" fill="#9a6a3c"/><rect x="14" y="36" width="7" height="7" fill="#fff"/><rect x="39" y="36" width="7" height="7" fill="#fff"/><rect x="6" y="60" width="48" height="4" fill="#9aa0a6"/></svg>`;
}

/** A roof choice's picture: the house in its colours, under that roof. */
export function roofSwatch(bp: Blueprint, choice: number): string {
  const tile = choice === 0 ? (bp.roof.tile ?? 0xd2513a) : ROOF_CHOICES[choice - 1].tile;
  const wall = paintsOf(bp)[0];
  return `<svg viewBox="0 0 60 66"><rect x="10" y="30" width="40" height="30" fill="${hexc(wall)}"/><path d="M4 33L30 8l26 25z" fill="${hexc(tile)}"/><path d="M4 33L30 8l26 25" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2"/><rect x="26" y="44" width="8" height="16" fill="#9a6a3c"/><rect x="14" y="36" width="7" height="7" fill="#fff"/><rect x="39" y="36" width="7" height="7" fill="#fff"/><rect x="6" y="60" width="48" height="4" fill="#9aa0a6"/></svg>`;
}
