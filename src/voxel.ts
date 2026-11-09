import * as THREE from "three";

/**
 * Little models made of cubes, the way Kickstack builds them: a model is a set of coloured cells,
 * and building it emits only the faces between a cell and empty space, each shaded by which way it
 * faces (tops lightest, bottoms darkest) for a crisp look without relying on the lights alone.
 *
 * Coordinates: x forward, y up, z right (three's axes for a model facing +x). A cell (x, y, z)
 * fills [x, x+1) x [y, y+1) x [z, z+1); `build` scales by `unit` around `pivot` (in cells).
 */
export class Model {
  private cells = new Map<string, number>();

  private static key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  set(x: number, y: number, z: number, color: number): this {
    this.cells.set(Model.key(x, y, z), color);
    return this;
  }

  box(x0: number, y0: number, z0: number, w: number, h: number, d: number, color: number): this {
    for (let x = x0; x < x0 + w; x++)
      for (let y = y0; y < y0 + h; y++)
        for (let z = z0; z < z0 + d; z++) this.cells.set(Model.key(x, y, z), color);
    return this;
  }

  clear(x0: number, y0: number, z0: number, w: number, h: number, d: number): this {
    for (let x = x0; x < x0 + w; x++)
      for (let y = y0; y < y0 + h; y++)
        for (let z = z0; z < z0 + d; z++) this.cells.delete(Model.key(x, y, z));
    return this;
  }

  has(x: number, y: number, z: number): boolean {
    return this.cells.has(Model.key(x, y, z));
  }

  get(x: number, y: number, z: number): number | undefined {
    return this.cells.get(Model.key(x, y, z));
  }

  /** Recolours every cell `f` says to (returns undefined to keep it). */
  recolor(f: (x: number, y: number, z: number, c: number) => number | undefined): this {
    for (const [k, c] of this.cells) {
      const [x, y, z] = k.split(",").map(Number);
      const n = f(x, y, z, c);
      if (n !== undefined) this.cells.set(k, n);
    }
    return this;
  }

  /** Another model's cells, moved by this many cells. */
  stamp(other: Model, dx: number, dy: number, dz: number): this {
    for (const [k, c] of other.cells) {
      const [x, y, z] = k.split(",").map(Number);
      this.cells.set(Model.key(x + dx, y + dy, z + dz), c);
    }
    return this;
  }

  get size(): number {
    return this.cells.size;
  }

  geometry(unit: number, pivot: [number, number, number] = [0, 0, 0]): THREE.BufferGeometry {
    const f = new Faces();
    for (const [k, color] of this.cells) {
      const [x, y, z] = k.split(",").map(Number);
      for (const d of DIRS) {
        if (!this.cells.has(Model.key(x + d.n[0], y + d.n[1], z + d.n[2])))
          f.quad(d, x, y, z, 1, 1, 1, color, unit, pivot);
      }
    }
    return f.geometry();
  }

  /** A mesh of this model, casting and taking shadows. */
  mesh(unit: number, pivot: [number, number, number] = [0, 0, 0], material: THREE.Material = voxelMaterial): THREE.Mesh {
    const m = new THREE.Mesh(this.geometry(unit, pivot), material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

/** One material for every voxel model: the colours live in the vertices. */
export const voxelMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

interface Dir {
  n: [number, number, number];
  corners: [number, number, number][];
  shade: number;
}

// Corners counter-clockwise seen from outside; tops lighter and bottoms darker.
const DIRS: Dir[] = [
  { n: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.92 },
  { n: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.8 },
  { n: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.6 },
  { n: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.86 },
  { n: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.86 },
];

/** Linear-light component of an sRGB channel (three's vertex colours are linear). */
const lin = (c: number) => Math.pow(c / 255, 2.2);

/**
 * Faces collected into one geometry. Boxes may be any size (the pit and slab use this with
 * half-tile columns); `quad` takes a cell origin and a size in cells.
 */
export class Faces {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];

  quad(
    d: Dir,
    x: number, y: number, z: number,
    w: number, h: number, depth: number,
    color: number,
    unit: number,
    pivot: [number, number, number],
  ): void {
    const r = lin((color >> 16) & 0xff) * d.shade;
    const g = lin((color >> 8) & 0xff) * d.shade;
    const b = lin(color & 0xff) * d.shade;
    const cs = d.corners.map(([cx, cy, cz]) => [
      (x + cx * w - pivot[0]) * unit,
      (y + cy * h - pivot[1]) * unit,
      (z + cz * depth - pivot[2]) * unit,
    ]);
    for (const i of [0, 1, 2, 0, 2, 3]) {
      this.pos.push(cs[i][0], cs[i][1], cs[i][2]);
      this.nor.push(d.n[0], d.n[1], d.n[2]);
      this.col.push(r, g, b);
    }
  }

  /** A whole box in world units, with every face (or those `faces` allows). */
  box(
    x: number, y: number, z: number, w: number, h: number, d: number,
    color: number,
    faces: (n: [number, number, number]) => boolean = () => true,
    sideColor = color,
  ): void {
    for (const dir of DIRS) {
      if (!faces(dir.n)) continue;
      const c = dir.n[1] === 1 ? color : sideColor;
      this.quad(dir, x, y, z, w, h, d, c, 1, [0, 0, 0]);
    }
  }

  geometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    return geo;
  }
}
