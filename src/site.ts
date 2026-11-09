import * as THREE from "three";
import { Faces, Model, voxelMaterial } from "./voxel";
import * as M from "./models";
import { C, Cell } from "./models";
import * as B from "./blueprints";

/**
 * The construction site: sand inside a barrier fence, grass and trees outside, a site office, the
 * panels' trailer and the roof's pallet. In the middle, the building's footprint, held as a grid of
 * half-tile columns whose tops move as the pit is dug and the slab is poured; and in front of it,
 * the path to the gate that the roller paves at the end.
 *
 * World axes: x east (right on screen), z south (toward the camera), y up. One tile = 1.
 */
export const SITE = { minX: -12, maxX: 12, minZ: -9, maxZ: 9 };
const CELL = 0.5;
export const PIT_DEPTH = 0.5;
/**
 * Once the pit's dug, a gravel bed goes in and fills most of it, and wet concrete fills to the
 * ground's level until the slab sets. So the mixer drives over steps no taller than a kerb rather
 * than tipping down into a half-tile hole and through its walls.
 */
const GRAVEL_BED = -0.14;
export const SLAB_TOP = B.SLAB_TOP;
export const WALL_H = B.WALL_H;
export const SCOOPS_PER_QUADRANT = 2;
/** The path from the front door to the gate: three half-tile cells wide. */
export const PATH = { minX: -0.75, maxX: 0.75 };

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

/** What machines drive on and bump into: the site, or the town. */
export interface Ground {
  boxes: Box[];
  circles: Circle[];
  heightAt(x: number, z: number): number;
}

export interface Foot {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
}

type Kind = "dirt" | "gravel" | "wet" | "concrete";

/** One quarter of the footprint, the excavator's dig spot beside it, and where its dirt goes. */
export interface Quadrant {
  i0: number;
  i1: number;
  j0: number;
  j1: number;
  centre: THREE.Vector2;
  spot: THREE.Vector2;
  moundAt: THREE.Vector2;
  scoops: number;
  mound: THREE.Mesh | null;
}

export interface WallSlot extends B.Slot {
  box: Box | null; // what machines bump into once it's up (the ground floor's only)
}

export class Site implements Ground {
  readonly root = new THREE.Group();
  readonly boxes: Box[] = [];
  readonly circles: Circle[] = [];
  readonly quadrants: Quadrant[] = [];
  readonly slots: WallSlot[];
  readonly foot: Foot;
  readonly roofAt: THREE.Vector3;
  private readonly NX: number;
  private readonly NZ: number;

  private top: number[][] = [];
  private target: number[][] = [];
  private kind: Kind[][] = [];
  private pitMesh: THREE.Mesh | null = null;
  readonly pitGroup = new THREE.Group();
  private dirty = true;
  /** The string lines and pegs round the footprint, shown until the pit's dug. */
  readonly strings = new THREE.Group();

  /** The path's cells, front door to gate: paved or not. */
  readonly path: { x: number; z: number; paved: boolean }[] = [];
  private pathMesh: THREE.Mesh | null = null;
  private pathDirty = true;

  constructor(readonly bp: B.Blueprint) {
    // The footprint's front edge is always at z = 0.5, centred across x.
    const maxZ = 0.5;
    this.foot = { minX: -bp.w / 2, maxX: bp.w / 2, minZ: maxZ - bp.d, maxZ, cx: 0, cz: maxZ - bp.d / 2 };
    this.NX = bp.w * 2;
    this.NZ = bp.d * 2;
    for (let i = 0; i < this.NX; i++) {
      this.top.push(new Array(this.NZ).fill(0));
      this.target.push(new Array(this.NZ).fill(0));
      this.kind.push(new Array(this.NZ).fill("dirt"));
    }
    this.root.add(this.pitGroup);
    this.buildGround();
    this.buildFence();
    this.buildProps();
    this.buildStrings();

    const F = this.foot;
    const hx = Math.floor(this.NX / 2), hz = Math.floor(this.NZ / 2);
    for (const [qi, qj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const sx = qi === 0 ? -1 : 1, sz = qj === 0 ? -1 : 1;
      const i0 = qi === 0 ? 0 : hx, i1 = qi === 0 ? hx : this.NX;
      const j0 = qj === 0 ? 0 : hz, j1 = qj === 0 ? hz : this.NZ;
      const centre = new THREE.Vector2(F.minX + ((i0 + i1) / 2) * CELL, F.minZ + ((j0 + j1) / 2) * CELL);
      const spot = centre.clone().add(new THREE.Vector2(sx, sz).multiplyScalar(1.9));
      const moundAt = spot.clone().add(new THREE.Vector2(sx, sz).multiplyScalar(1.45));
      this.quadrants.push({ i0, i1, j0, j1, centre, spot, moundAt, scoops: 0, mound: null });
    }

    this.slots = B.slots(bp).map((s) => {
      const centre = s.centre.clone().add(new THREE.Vector3(F.cx, 0, F.cz));
      const along = s.yaw === 0;
      const half = (s.len * Cell) / 2;
      const box: Box | null =
        s.storey > 0 ? null
        : along ? { minX: centre.x - half, maxX: centre.x + half, minZ: centre.z - 0.1, maxZ: centre.z + 0.1 }
        : { minX: centre.x - 0.1, maxX: centre.x + 0.1, minZ: centre.z - half, maxZ: centre.z + half };
      return { ...s, centre, box };
    });
    this.roofAt = B.roofAt(bp).add(new THREE.Vector3(F.cx, 0, F.cz));

    for (let z = F.maxZ; z < SITE.maxZ - 0.01; z += CELL)
      for (let x = PATH.minX; x < PATH.maxX - 0.01; x += CELL) this.path.push({ x: x + CELL / 2, z: z + CELL / 2, paved: false });
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

    const F = this.foot;
    const f = new Faces();
    const sand = (x0: number, x1: number, z0: number, z1: number) =>
      f.box(x0, -1, z0, x1 - x0, 1, z1 - z0, C.Sand, (n) => n[1] !== -1, C.Earth);
    sand(SITE.minX, SITE.maxX, SITE.minZ, F.minZ);
    sand(SITE.minX, SITE.maxX, F.maxZ, SITE.maxZ);
    sand(SITE.minX, F.minX, F.minZ, F.maxZ);
    sand(F.maxX, SITE.maxX, F.minZ, F.maxZ);
    // Tyre-track speckle: a few slightly darker patches so the sand isn't one flat colour.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 70; k++) {
      const x = SITE.minX + 0.5 + rnd() * (SITE.maxX - SITE.minX - 1.5);
      const z = SITE.minZ + 0.5 + rnd() * (SITE.maxZ - SITE.minZ - 1.5);
      if (x > F.minX - 0.6 && x < F.maxX + 0.6 && z > F.minZ - 0.6 && z < F.maxZ + 0.6) continue;
      const w = 0.3 + rnd() * 0.6, d = 0.3 + rnd() * 0.6;
      if (x + w > PATH.minX - 0.1 && x < PATH.maxX + 0.1 && z + d > F.maxZ) continue; // not on the path
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
  /** For a building of more than one storey, its floor decks wait on a second pallet. */
  readonly floorPalletAt = new THREE.Vector3(-9, 0, -6.45);

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
    if (this.bp.storeys > 1) {
      const p2 = M.pallet().mesh(Cell, [22.5, 0, 23]);
      p2.position.copy(this.floorPalletAt);
      this.root.add(p2);
      this.boxes.push({ minX: this.floorPalletAt.x - 2.25, maxX: this.floorPalletAt.x + 2.25, minZ: this.floorPalletAt.z - 2.3, maxZ: this.floorPalletAt.z + 2.25 });
    }

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
    const F = this.foot;
    const pegs = M.peg();
    const m = 0.25;
    const corners: [number, number][] = [
      [F.minX - m, F.minZ - m], [F.maxX + m, F.minZ - m],
      [F.maxX + m, F.maxZ + m], [F.minX - m, F.maxZ + m],
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
    return this.foot.minX + i * CELL;
  }
  private cellZ(j: number): number {
    return this.foot.minZ + j * CELL;
  }

  private rebuildPit(): void {
    const f = new Faces();
    const colour = (k: Kind, t: number) =>
      k === "concrete" ? (this.bp.slab ?? C.Concrete) : k === "wet" ? C.WetConcrete : k === "gravel" ? C.Gravel : t < -0.01 ? 0x8c6239 : C.Sand;
    for (let i = 0; i < this.NX; i++)
      for (let j = 0; j < this.NZ; j++) {
        const t = this.top[i][j];
        const k = this.kind[i][j];
        const x = this.cellX(i), z = this.cellZ(j);
        f.box(x, t, z, CELL, 0, CELL, colour(k, t), (n) => n[1] === 1);
        const side = k === "concrete" || k === "wet" ? (k === "wet" ? 0x7d848a : 0xb3b6b8) : C.Earth;
        const nbs: [number, number, [number, number, number]][] = [
          [i + 1, j, [1, 0, 0]], [i - 1, j, [-1, 0, 0]], [i, j + 1, [0, 0, 1]], [i, j - 1, [0, 0, -1]],
        ];
        for (const [ni, nj, n] of nbs) {
          const inside = ni >= 0 && nj >= 0 && ni < this.NX && nj < this.NZ;
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
    const F = this.foot;
    if (x <= F.minX || x >= F.maxX || z <= F.minZ || z >= F.maxZ) return 0;
    const i = Math.min(this.NX - 1, Math.floor((x - F.minX) / CELL));
    const j = Math.min(this.NZ - 1, Math.floor((z - F.minZ) / CELL));
    return this.top[i][j];
  }

  /** One bucketful out of a quadrant; true once it's all dug. */
  scoop(q: Quadrant): boolean {
    q.scoops = Math.min(SCOOPS_PER_QUADRANT, q.scoops + 1);
    const depth = -PIT_DEPTH * (q.scoops / SCOOPS_PER_QUADRANT);
    for (let i = q.i0; i < q.i1; i++)
      for (let j = q.j0; j < q.j1; j++) {
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

  /** The gravel bed goes into the dug pit, ready to pour on. */
  layBed(): void {
    for (let i = 0; i < this.NX; i++)
      for (let j = 0; j < this.NZ; j++) {
        this.kind[i][j] = "gravel";
        this.target[i][j] = GRAVEL_BED;
      }
  }

  /** Pours concrete into the cells within `r` of (x, z); returns how many started filling. */
  pour(x: number, z: number, r: number): number {
    let n = 0;
    for (let i = 0; i < this.NX; i++)
      for (let j = 0; j < this.NZ; j++) {
        if (this.kind[i][j] !== "gravel") continue;
        const cx = this.cellX(i) + CELL / 2, cz = this.cellZ(j) + CELL / 2;
        if (Math.hypot(cx - x, cz - z) > r) continue;
        this.kind[i][j] = "wet";
        this.target[i][j] = 0;
        n++;
      }
    return n;
  }

  /** How much of the slab is poured, 0..1. */
  poured(): number {
    let n = 0;
    for (const row of this.kind) for (const k of row) if (k === "wet" || k === "concrete") n++;
    return n / (this.NX * this.NZ);
  }

  /** The cells still to pour, as world points (for the pour's guide). */
  unpoured(): THREE.Vector2[] {
    const out: THREE.Vector2[] = [];
    for (let i = 0; i < this.NX; i++)
      for (let j = 0; j < this.NZ; j++)
        if (this.kind[i][j] === "gravel") out.push(new THREE.Vector2(this.cellX(i) + CELL / 2, this.cellZ(j) + CELL / 2));
    return out;
  }

  /** Fills whatever's left and sets the whole slab. */
  finishSlab(): void {
    for (let i = 0; i < this.NX; i++)
      for (let j = 0; j < this.NZ; j++) {
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
    this.layBed();
    for (let i = 0; i < this.NX; i++) for (let j = 0; j < this.NZ; j++) this.top[i][j] = this.target[i][j];
    this.strings.visible = false;
    this.dirty = true;
  }

  // ------------------------------------------------------------ the path

  /**
   * Paves the path's cells under a roller drum at (x, z) facing `heading`: `half` along the
   * heading, `across` to each side. Returns how many were newly paved.
   */
  pave(x: number, z: number, heading: number, half: number, across: number): THREE.Vector2[] {
    const fx = Math.cos(heading), fz = -Math.sin(heading);
    const out: THREE.Vector2[] = [];
    for (const c of this.path) {
      if (c.paved) continue;
      const dx = c.x - x, dz = c.z - z;
      const a = dx * fx + dz * fz;
      const s = -dx * fz + dz * fx;
      if (Math.abs(a) <= half + 0.2 && Math.abs(s) <= across + 0.05) {
        c.paved = true;
        out.push(new THREE.Vector2(c.x, c.z));
      }
    }
    if (out.length) this.pathDirty = true;
    return out;
  }

  paved(): number {
    return this.path.filter((c) => c.paved).length / this.path.length;
  }

  unpaved(): THREE.Vector2[] {
    return this.path.filter((c) => !c.paved).map((c) => new THREE.Vector2(c.x, c.z));
  }

  finishPath(): void {
    for (const c of this.path) c.paved = true;
    this.pathDirty = true;
  }

  private rebuildPath(): void {
    const f = new Faces();
    for (const c of this.path) {
      const x = c.x - CELL / 2, z = c.z - CELL / 2;
      if (c.paved) {
        // Light paving slabs with a darker joint round each.
        f.box(x, 0.0, z, CELL, 0.03, CELL, 0x8d939a, (n) => n[1] === 1);
        f.box(x + 0.03, 0.031, z + 0.03, CELL - 0.06, 0, CELL - 0.06, 0xc3c7cc, (n) => n[1] === 1);
      } else {
        const odd = (Math.round(c.x * 2) + Math.round(c.z * 2)) % 2 === 0;
        f.box(x, 0.004, z, CELL, 0, CELL, odd ? 0xb08d5f : 0xa98659, (n) => n[1] === 1);
      }
    }
    if (this.pathMesh) {
      this.pathMesh.geometry.dispose();
      this.root.remove(this.pathMesh);
    }
    this.pathMesh = new THREE.Mesh(f.geometry(), voxelMaterial);
    this.pathMesh.receiveShadow = true;
    this.root.add(this.pathMesh);
  }

  update(dt: number): void {
    const rate = 1.6 * dt;
    for (let i = 0; i < this.NX; i++)
      for (let j = 0; j < this.NZ; j++) {
        const t = this.top[i][j], g = this.target[i][j];
        if (t === g) continue;
        this.top[i][j] = Math.abs(g - t) <= rate ? g : t + Math.sign(g - t) * rate;
        this.dirty = true;
      }
    if (this.dirty) {
      this.rebuildPit();
      this.dirty = false;
    }
    if (this.pathDirty) {
      this.rebuildPath();
      this.pathDirty = false;
    }
  }
}
