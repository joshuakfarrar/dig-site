import * as THREE from "three";
import { Faces, Model, voxelMaterial } from "./voxel";
import * as M from "./models";
import { C, Cell } from "./models";

/**
 * The construction site: sand inside a barrier fence, grass and trees outside, a site office, the
 * panels' trailer and the roof's pallet. In the middle, the building's 4 x 4 footprint, held as an
 * 8 x 8 grid of half-tile columns whose tops move as the pit is dug and the slab is poured.
 *
 * World axes: x east (right on screen), z south (toward the camera), y up. One tile = 1.
 */
export const SITE = { minX: -12, maxX: 12, minZ: -9, maxZ: 9 };
export const FOOT = { minX: -2, maxX: 2, minZ: -3.5, maxZ: 0.5, cx: 0, cz: -1.5 };
const N = 8;
const CELL = 0.5;
export const PIT_DEPTH = 0.5;
export const SLAB_TOP = 0.1;
export const WALL_H = 1.4;

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export interface Circle {
  x: number;
  z: number;
  r: number;
}

type Kind = "dirt" | "gravel" | "wet" | "concrete";

/** One quarter of the footprint, the excavator's dig spot beside it, and where its dirt goes. */
export interface Quadrant {
  i0: number;
  j0: number;
  centre: THREE.Vector2;
  spot: THREE.Vector2;
  moundAt: THREE.Vector2;
  scoops: number; // 0..2
  mound: THREE.Mesh | null;
}

export interface WallSlot {
  name: string;
  centre: THREE.Vector3; // middle of the panel
  yaw: number;
  len: number;
  style: M.PanelStyle;
  box: Box;
}

export const SCOOPS_PER_QUADRANT = 2;

export class Site {
  readonly root = new THREE.Group();
  readonly boxes: Box[] = [];
  readonly circles: Circle[] = [];
  readonly quadrants: Quadrant[] = [];
  readonly slots: WallSlot[];

  private top: number[][] = [];
  private target: number[][] = [];
  private kind: Kind[][] = [];
  private pitMesh: THREE.Mesh | null = null;
  readonly pitGroup = new THREE.Group();
  private dirty = true;
  /** The string lines and pegs round the footprint, shown until the pit's dug. */
  readonly strings = new THREE.Group();

  constructor() {
    for (let i = 0; i < N; i++) {
      this.top.push(new Array(N).fill(0));
      this.target.push(new Array(N).fill(0));
      this.kind.push(new Array(N).fill("dirt"));
    }
    this.root.add(this.pitGroup);
    this.buildGround();
    this.buildFence();
    this.buildProps();
    this.buildStrings();

    for (const [qi, qj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const sx = qi === 0 ? -1 : 1, sz = qj === 0 ? -1 : 1;
      const centre = new THREE.Vector2(FOOT.cx + sx, FOOT.cz + sz);
      const spot = centre.clone().add(new THREE.Vector2(sx, sz).multiplyScalar(1.9));
      const moundAt = spot.clone().add(new THREE.Vector2(sx, sz).multiplyScalar(1.45));
      this.quadrants.push({ i0: qi * 4, j0: qj * 4, centre, spot, moundAt, scoops: 0, mound: null });
    }

    const y = SLAB_TOP + WALL_H / 2;
    const t = 0.2;
    this.slots = [
      {
        name: "back", len: 40, yaw: 0, centre: new THREE.Vector3(0, y, FOOT.minZ + t / 2),
        style: { paint: 0x9ad9b5, windows: [10, 30] },
        box: { minX: FOOT.minX, maxX: FOOT.maxX, minZ: FOOT.minZ, maxZ: FOOT.minZ + t },
      },
      {
        name: "right", len: 36, yaw: Math.PI / 2, centre: new THREE.Vector3(FOOT.maxX - t / 2, y, FOOT.cz),
        style: { paint: 0xf6b38a, windows: [18] },
        box: { minX: FOOT.maxX - t, maxX: FOOT.maxX, minZ: FOOT.minZ + t, maxZ: FOOT.maxZ - t },
      },
      {
        name: "left", len: 36, yaw: Math.PI / 2, centre: new THREE.Vector3(FOOT.minX + t / 2, y, FOOT.cz),
        style: { paint: 0xb9a6e6, windows: [18] },
        box: { minX: FOOT.minX, maxX: FOOT.minX + t, minZ: FOOT.minZ + t, maxZ: FOOT.maxZ - t },
      },
      {
        name: "front", len: 40, yaw: 0, centre: new THREE.Vector3(0, y, FOOT.maxZ - t / 2),
        style: { paint: 0x8fc8f0, windows: [7, 33], door: true },
        box: { minX: FOOT.minX, maxX: FOOT.maxX, minZ: FOOT.maxZ - t, maxZ: FOOT.maxZ },
      },
    ];
  }

  // ------------------------------------------------------------ ground and the pit

  private buildGround(): void {
    // Grass all round the site, but not under it: the pit goes below the grass's level.
    const grassMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(C.Grass) });
    const far = 110;
    const strips: [number, number, number, number][] = [
      [-far, far, -far, SITE.minZ],
      [-far, far, SITE.maxZ, far],
      [-far, SITE.minX, SITE.minZ, SITE.maxZ],
      [SITE.maxX, far, SITE.minZ, SITE.maxZ],
    ];
    for (const [x0, x1, z0, z1] of strips) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), grassMat);
      g.rotation.x = -Math.PI / 2;
      g.position.set((x0 + x1) / 2, -0.02, (z0 + z1) / 2);
      g.receiveShadow = true;
      this.root.add(g);
    }

    const f = new Faces();
    const sand = (x0: number, x1: number, z0: number, z1: number) =>
      f.box(x0, -1, z0, x1 - x0, 1, z1 - z0, C.Sand, (n) => n[1] !== -1, C.Earth);
    sand(SITE.minX, SITE.maxX, SITE.minZ, FOOT.minZ);
    sand(SITE.minX, SITE.maxX, FOOT.maxZ, SITE.maxZ);
    sand(SITE.minX, FOOT.minX, FOOT.minZ, FOOT.maxZ);
    sand(FOOT.maxX, SITE.maxX, FOOT.minZ, FOOT.maxZ);
    // Tyre-track speckle: a few slightly darker patches so the sand isn't one flat colour.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 70; k++) {
      const x = SITE.minX + 0.5 + rnd() * (SITE.maxX - SITE.minX - 1.5);
      const z = SITE.minZ + 0.5 + rnd() * (SITE.maxZ - SITE.minZ - 1.5);
      if (x > FOOT.minX - 0.6 && x < FOOT.maxX + 0.6 && z > FOOT.minZ - 0.6 && z < FOOT.maxZ + 0.6) continue;
      const w = 0.3 + rnd() * 0.6, d = 0.3 + rnd() * 0.6;
      f.box(x, 0.001, z, w, 0, d, rnd() < 0.5 ? 0xcfa970 : 0xe0bd88, (n) => n[1] === 1);
    }
    const mesh = new THREE.Mesh(f.geometry(), voxelMaterial);
    mesh.receiveShadow = true;
    this.root.add(mesh);
  }

  private buildFence(): void {
    const m = new Model();
    const seg = M.barrier();
    // Along the north and south edges (x), then east and west (z), with a gap for a gate at the south.
    for (let x = SITE.minX; x < SITE.maxX; x++) {
      m.stamp(seg, x * 10, 0, SITE.minZ * 10 - 1);
      if (x < -2 || x > 1) m.stamp(seg, x * 10, 0, SITE.maxZ * 10);
    }
    const side = new Model();
    for (let z = SITE.minZ; z < SITE.maxZ; z++) side.stamp(seg, z * 10, 0, 0);
    const fence = m.mesh(Cell);
    this.root.add(fence);
    for (const x of [SITE.minX - 0.1, SITE.maxX]) {
      const s = side.mesh(Cell);
      s.rotation.y = -Math.PI / 2;
      s.position.set(x + 0.1, 0, 0);
      this.root.add(s);
    }
    const t = 1;
    this.boxes.push(
      { minX: SITE.minX - t, maxX: SITE.maxX + t, minZ: SITE.minZ - t, maxZ: SITE.minZ },
      { minX: SITE.minX - t, maxX: SITE.maxX + t, minZ: SITE.maxZ, maxZ: SITE.maxZ + t },
      { minX: SITE.minX - t, maxX: SITE.minX, minZ: SITE.minZ - t, maxZ: SITE.maxZ + t },
      { minX: SITE.maxX, maxX: SITE.maxX + t, minZ: SITE.minZ - t, maxZ: SITE.maxZ + t },
    );
  }

  /** Where the trailer's deck is, and the roof's pallet. */
  readonly trailerAt = new THREE.Vector3(9, 0, -1.9);
  readonly deckTop = 0.6;
  readonly palletAt = new THREE.Vector3(-9, 0, -1.6);
  readonly palletTop = 0.3;

  private buildProps(): void {
    const office = M.office().mesh(Cell);
    office.position.set(-11.3, 0, 5.6);
    this.root.add(office);
    this.boxes.push({ minX: -11.3, maxX: -8.3, minZ: 5.6, maxZ: 7.9 });

    const trailer = M.trailer().mesh(Cell, [22, 0, 9]);
    trailer.rotation.y = Math.PI / 2;
    trailer.position.copy(this.trailerAt);
    this.root.add(trailer);
    this.boxes.push({ minX: this.trailerAt.x - 0.9, maxX: this.trailerAt.x + 0.9, minZ: this.trailerAt.z - 2.7, maxZ: this.trailerAt.z + 2.2 });

    const pallet = M.pallet().mesh(Cell, [22.5, 0, 23]);
    pallet.position.copy(this.palletAt);
    this.root.add(pallet);
    this.boxes.push({ minX: this.palletAt.x - 2.25, maxX: this.palletAt.x + 2.25, minZ: this.palletAt.z - 2.3, maxZ: this.palletAt.z + 2.3 });

    const cone = M.cone();
    for (const [x, z] of [[-2.6, 8.3], [1.6, 8.3], [-11.3, -8.3], [11.3, -8.3], [11.3, 8.3], [-6.5, 8.3]]) {
      const c = cone.mesh(Cell, [0, 0, 0]);
      c.position.set(x, 0, z);
      this.root.add(c);
    }

    // Trees round the outside.
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const trees = [M.tree(0), M.tree(1)];
    for (let k = 0; k < 46; k++) {
      const a = rnd() * Math.PI * 2;
      const rx = 15 + rnd() * 9, rz = 12 + rnd() * 8;
      const x = Math.cos(a) * rx, z = Math.sin(a) * rz;
      if (z > 9 && z < 20 && Math.abs(x) < 9) continue; // keep the view in front of the site open
      const t = trees[k % 2].mesh(Cell);
      t.position.set(x, 0, z);
      t.rotation.y = rnd() * Math.PI;
      t.scale.setScalar(0.9 + rnd() * 0.5);
      this.root.add(t);
    }
  }

  private buildStrings(): void {
    const pegs = M.peg();
    const m = 0.25;
    const corners: [number, number][] = [
      [FOOT.minX - m, FOOT.minZ - m], [FOOT.maxX + m, FOOT.minZ - m],
      [FOOT.maxX + m, FOOT.maxZ + m], [FOOT.minX - m, FOOT.maxZ + m],
    ];
    for (const [x, z] of corners) {
      const p = pegs.mesh(Cell, [0.5, 0, 0.5]);
      p.position.set(x, 0, z);
      this.strings.add(p);
    }
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az);
      const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.03), mat);
      s.position.set((ax + bx) / 2, 0.42, (az + bz) / 2);
      s.rotation.y = -Math.atan2(bz - az, bx - ax);
      this.strings.add(s);
    }
    this.root.add(this.strings);
  }

  private cellX(i: number): number {
    return FOOT.minX + i * CELL;
  }
  private cellZ(j: number): number {
    return FOOT.minZ + j * CELL;
  }

  private rebuildPit(): void {
    const f = new Faces();
    const colour = (k: Kind, t: number) =>
      k === "concrete" ? C.Concrete : k === "wet" ? C.WetConcrete : k === "gravel" ? C.Gravel : t < -0.01 ? 0x8c6239 : C.Sand;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const t = this.top[i][j];
        const k = this.kind[i][j];
        const x = this.cellX(i), z = this.cellZ(j);
        f.box(x, t, z, CELL, 0, CELL, colour(k, t), (n) => n[1] === 1);
        const side = k === "concrete" || k === "wet" ? (k === "wet" ? 0x7d848a : 0xb3b6b8) : C.Earth;
        const nbs: [number, number, [number, number, number]][] = [
          [i + 1, j, [1, 0, 0]], [i - 1, j, [-1, 0, 0]], [i, j + 1, [0, 0, 1]], [i, j - 1, [0, 0, -1]],
        ];
        for (const [ni, nj, n] of nbs) {
          const inside = ni >= 0 && nj >= 0 && ni < N && nj < N;
          const nt = inside ? this.top[ni][nj] : 0;
          if (nt >= t) continue;
          f.box(x, nt, z, CELL, t - nt, CELL, side, (d) => d[0] === n[0] && d[1] === n[1] && d[2] === n[2], side);
        }
      }
    if (this.pitMesh) {
      this.pitMesh.geometry.dispose();
      this.pitGroup.remove(this.pitMesh);
    }
    this.pitMesh = new THREE.Mesh(f.geometry(), voxelMaterial);
    this.pitMesh.receiveShadow = true;
    this.pitMesh.castShadow = true;
    this.pitGroup.add(this.pitMesh);
  }

  /** The ground's height under (x, z): the pit's columns inside the footprint, 0 elsewhere. */
  heightAt(x: number, z: number): number {
    if (x <= FOOT.minX || x >= FOOT.maxX || z <= FOOT.minZ || z >= FOOT.maxZ) return 0;
    const i = Math.min(N - 1, Math.floor((x - FOOT.minX) / CELL));
    const j = Math.min(N - 1, Math.floor((z - FOOT.minZ) / CELL));
    return this.top[i][j];
  }

  /** One bucketful out of a quadrant; true once it's all dug. */
  scoop(q: Quadrant): boolean {
    q.scoops = Math.min(SCOOPS_PER_QUADRANT, q.scoops + 1);
    const depth = -PIT_DEPTH * (q.scoops / SCOOPS_PER_QUADRANT);
    for (let i = q.i0; i < q.i0 + 4; i++)
      for (let j = q.j0; j < q.j0 + 4; j++) {
        this.target[i][j] = depth;
        if (q.scoops >= SCOOPS_PER_QUADRANT) this.kind[i][j] = "gravel";
      }
    return q.scoops >= SCOOPS_PER_QUADRANT;
  }

  /** The dirt from a bucketful lands by the dig spot: the mound grows a size. */
  growMound(q: Quadrant): THREE.Vector3 {
    if (q.mound) this.root.remove(q.mound);
    q.mound = M.mound(q.scoops).mesh(Cell);
    q.mound.position.set(q.moundAt.x, 0, q.moundAt.y);
    this.root.add(q.mound);
    const existing = this.circles.find((c) => c.x === q.moundAt.x && c.z === q.moundAt.y);
    const r = (3 + q.scoops * 2.2) * Cell;
    if (existing) existing.r = r;
    else this.circles.push({ x: q.moundAt.x, z: q.moundAt.y, r });
    return new THREE.Vector3(q.moundAt.x, 0.2, q.moundAt.y);
  }

  pitDug(): boolean {
    return this.quadrants.every((q) => q.scoops >= SCOOPS_PER_QUADRANT);
  }

  /** Pours concrete into the cells within `r` of (x, z); returns how many started filling. */
  pour(x: number, z: number, r: number): number {
    let n = 0;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        if (this.kind[i][j] !== "gravel") continue;
        const cx = this.cellX(i) + CELL / 2, cz = this.cellZ(j) + CELL / 2;
        if (Math.hypot(cx - x, cz - z) > r) continue;
        this.kind[i][j] = "wet";
        this.target[i][j] = SLAB_TOP;
        n++;
      }
    return n;
  }

  /** How much of the slab is poured, 0..1. */
  poured(): number {
    let n = 0;
    for (const row of this.kind) for (const k of row) if (k === "wet" || k === "concrete") n++;
    return n / (N * N);
  }

  /** The cells still to pour, as world points (for the pour's guide). */
  unpoured(): THREE.Vector2[] {
    const out: THREE.Vector2[] = [];
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++)
        if (this.kind[i][j] === "gravel") out.push(new THREE.Vector2(this.cellX(i) + CELL / 2, this.cellZ(j) + CELL / 2));
    return out;
  }

  /** Fills whatever's left and sets the whole slab. */
  finishSlab(): void {
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        this.kind[i][j] = "concrete";
        this.target[i][j] = SLAB_TOP;
        this.top[i][j] = SLAB_TOP;
      }
    this.dirty = true;
  }

  /** Skips straight to a dug pit (for `?stage=`). */
  digAll(): void {
    for (const q of this.quadrants) {
      while (q.scoops < SCOOPS_PER_QUADRANT) {
        this.scoop(q);
        this.growMound(q);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) this.top[i][j] = this.target[i][j];
    this.strings.visible = false;
    this.dirty = true;
  }

  update(dt: number): void {
    const rate = 1.6 * dt;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const t = this.top[i][j], g = this.target[i][j];
        if (t === g) continue;
        this.top[i][j] = Math.abs(g - t) <= rate ? g : t + Math.sign(g - t) * rate;
        this.dirty = true;
      }
    if (this.dirty) {
      this.rebuildPit();
      this.dirty = false;
    }
  }
}
