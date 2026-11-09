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

  /**
   * The model's outside faces, with neighbouring faces of the same colour that face the same way
   * merged into bigger rectangles ("greedy meshing"). It looks exactly the same as one square per
   * cell face, but a tree or a house comes out as a small fraction of the triangles, which a cheap
   * tablet needs.
   */
  geometry(unit: number, pivot: [number, number, number] = [0, 0, 0]): THREE.BufferGeometry {
    const f = new Faces();
    if (this.cells.size === 0) return f.geometry();
    const pts: [number, number, number, number][] = [];
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const [k, color] of this.cells) {
      const p = k.split(",").map(Number) as [number, number, number];
      pts.push([p[0], p[1], p[2], color]);
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], p[i]);
        hi[i] = Math.max(hi[i], p[i]);
      }
    }
    for (const d of DIRS) {
      const a = d.n[0] !== 0 ? 0 : d.n[1] !== 0 ? 1 : 2; // the axis this face looks along
      const u = a === 0 ? 1 : 0, v = a === 2 ? 1 : 2; // the two it spreads over
      const nu = hi[u] - lo[u] + 1, nv = hi[v] - lo[v] + 1;
      // The exposed faces, slice by slice along the facing axis.
      const slices = new Map<number, Map<number, number>>();
      for (const [x, y, z, color] of pts) {
        if (this.cells.has(Model.key(x + d.n[0], y + d.n[1], z + d.n[2]))) continue;
        const p = [x, y, z];
        let sl = slices.get(p[a]);
        if (!sl) slices.set(p[a], (sl = new Map()));
        sl.set((p[u] - lo[u]) + (p[v] - lo[v]) * nu, color);
      }
      for (const [s, sl] of slices) {
        const done = new Set<number>();
        for (let j = 0; j < nv; j++)
          for (let i = 0; i < nu; i++) {
            const at = i + j * nu;
            const color = sl.get(at);
            if (color === undefined || done.has(at)) continue;
            // As wide as the same colour runs, then as tall as whole rows of it run.
            let w = 1;
            while (i + w < nu && sl.get(at + w) === color && !done.has(at + w)) w++;
            let h = 1;
            grow: while (j + h < nv) {
              for (let k = 0; k < w; k++) {
                const b = at + k + h * nu;
                if (sl.get(b) !== color || done.has(b)) break grow;
              }
              h++;
            }
            for (let jj = 0; jj < h; jj++) for (let ii = 0; ii < w; ii++) done.add(at + ii + jj * nu);
            const o = [0, 0, 0], size = [1, 1, 1];
            o[a] = s;
            o[u] = lo[u] + i;
            o[v] = lo[v] + j;
            size[u] = w;
            size[v] = h;
            f.quad(d, o[0], o[1], o[2], size[0], size[1], size[2], color, unit, pivot);
          }
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
