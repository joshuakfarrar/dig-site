import * as THREE from "three";
import * as M from "./models";
import { C, Cell } from "./models";
import type { Model } from "./voxel";

/**
 * What can be built, as data: a footprint, how many storeys, each wall panel's paint and windows,
 * and a roof. Every building is made the same few ways (dig, pour, lift the walls, lift the roof,
 * roll the path), so a new kind of building is a new entry here, not new rules.
 *
 * Coordinates are relative to the middle of the footprint at ground level; the front is +z.
 */
export type Kind = "cottage" | "tall" | "shop" | "station";

export interface RoofSpec {
  model: () => Model;
  pivot: [number, number, number];
  height: number; // world units, from its foot to its highest point
  slingTop: number; // pivot to where the slings meet it
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
  return new THREE.Vector3(0, SLAB_TOP + WALL_H * bp.storeys, 0);
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
    new THREE.MeshLambertMaterial({ color: C.Concrete }),
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
  const r = roofMesh(bp);
  r.position.copy(roofAt(bp));
  g.add(r);
  return g;
}

// ------------------------------------------------------------------ the kinds

const Pastel = { mint: 0x9ad9b5, peach: 0xf6b38a, lilac: 0xb9a6e6, sky: 0x8fc8f0, butter: 0xf6dc7a, pink: 0xf7b6c8, cream: 0xf3e6c8 };
const RedTiles: M.RoofColours = { tile: 0xd2513a, tile2: 0xc2462f, under: 0xb84a33, gable: 0xf3e6c8 };
const SlateTiles: M.RoofColours = { tile: 0x5b7db8, tile2: 0x4e6ea6, under: 0x45608f, gable: 0xf3e6c8 };
const GreenTiles: M.RoofColours = { tile: 0x4f9d58, tile2: 0x45894d, under: 0x3c7a44, gable: 0xf3e6c8 };
const BrownTiles: M.RoofColours = { tile: 0xb0703a, tile2: 0x9c6232, under: 0x8a552b, gable: 0xf3e6c8 };

function gable(w: number, d: number, c: M.RoofColours): RoofSpec {
  const W = w * 10 + 4, D = d * 10 + 4;
  const h = M.gableHeight(d) * Cell;
  return { model: () => M.gableRoof(w, d, c), pivot: [W / 2, 0, D / 2], height: Math.max(h, 1.2), slingTop: h * 0.9 };
}

export function cottage(paints: [number, number, number, number], tiles: M.RoofColours): Blueprint {
  const [back, right, left, front] = paints;
  return {
    kind: "cottage", w: 4, d: 4, storeys: 1, colour: front,
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
    kind: "tall", w: 4, d: 4, storeys: 2, colour: paint,
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
    kind: "shop", w, d, storeys: 1, colour: paint,
    walls: [[
      { paint, windows: [12, 38] },
      { paint, windows: [18] },
      { paint, windows: [18] },
      { paint, windows: [], shopWindow: [4, 30], doorAt: 36, doorPaint: 0xffffff, awning },
    ]],
    roof: {
      model: () => M.iceCream(M.flatRoof(w, d, Pastel.cream, C.White), Math.round(W / 2), Math.round(D / 2), scoops[0], scoops[1]),
      pivot: [W / 2, 0, D / 2],
      height: 2.4,
      slingTop: 0.25,
    },
  };
}

export function station(): Blueprint {
  const w = 5, d = 4;
  const W = w * 10 + 2, D = d * 10 + 2;
  const Brick = 0xc0573f;
  return {
    kind: "station", w, d, storeys: 1, colour: 0xd8382c,
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
    },
  };
}

/** The town's eight lots and what goes on each. */
export const LOTS: Blueprint[] = [
  cottage([Pastel.mint, Pastel.peach, Pastel.lilac, Pastel.sky], RedTiles),
  shop(Pastel.pink, [0x6fd3b0, 0xffffff], [0xff9ec4, 0x8be0c0]),
  tall(Pastel.butter, SlateTiles),
  station(),
  cottage([Pastel.sky, Pastel.sky, Pastel.sky, Pastel.sky], GreenTiles),
  tall(Pastel.lilac, RedTiles),
  shop(Pastel.mint, [0xff7aa8, 0xffffff], [0x8a5a3c, 0xfff4d6]),
  cottage([Pastel.peach, Pastel.peach, Pastel.peach, Pastel.peach], BrownTiles),
];
