import * as THREE from "three";
import * as Audio from "./audio";
import * as Hud from "./hud";
import type * as Input from "./input";
import * as M from "./models";
import { C, Cell } from "./models";
import * as B from "./blueprints";
import { Fx } from "./fx";
import { Marker, Prompt, workGlyph, type Controls } from "./guide";
import { Crane, Excavator, Mixer, Roller, Truck, wrap, type Machine, type World } from "./machines";
import type { Box, Circle, Ground } from "./site";
import { disposeScene, lit, Pops, type Mode } from "./stage";
import { Faces, Model, voxelMaterial } from "./voxel";
import { scatterFlora, type Rect } from "./flora";

/**
 * The town: two streets of lots, a park, and the crew's yard with the machines parked in it. You
 * drive the crew's little truck round the roads. First load it at the yard: stop in the ring by
 * the pile and press Work. Then take the load to a lot. Each empty lot shows a little model of
 * what goes there, turning on a stand, and a ring on the road in front: stop in it and press Work
 * to unload and go and build it. Built lots get a garden, a fence and people, who wave as you pass.
 *
 * The truck only ever drives on the roads (everything else is a block it bumps against), and the
 * people only ever walk in their gardens and on the pavement, so the two never meet.
 */
const ROAD_A = -2;
const ROAD_B = 11;
const HALF = 1.5; // half a road's width
const SIDE_X = 18; // the side roads joining the two streets
const COLS = [-12, -4, 4, 12];
// ------------------------------------------------------------------ traffic

const LANE = 0.75; // from a road's middle to the middle of its lane
/**
 * The loop the town's traffic drives, keeping to its lane: east along the top street, down the
 * east side road, west along the bottom street and back up the west side road.
 */
const LOOP = [
  new THREE.Vector2(-SIDE_X + LANE, ROAD_A + LANE),
  new THREE.Vector2(SIDE_X - LANE, ROAD_A + LANE),
  new THREE.Vector2(SIDE_X - LANE, ROAD_B - LANE),
  new THREE.Vector2(-SIDE_X + LANE, ROAD_B - LANE),
];
const CAR_SPEED = 2.2;

interface Car {
  mesh: THREE.Mesh;
  pos: THREE.Vector2;
  heading: number;
  speed: number;
  next: number; // the corner it's heading for
  len: number; // half its length
  circles: Circle[]; // what the truck bumps into
}

/** The crew's yard, west of the side road. */
const YARD = { minX: -30.5, maxX: -20.4, minZ: -2.2, maxZ: 11.2 };

/** Where the streets end in the east, at the gates to the other neighbourhoods. */
const GATE_X = 25;

interface Gate {
  z: number; // which street it's across
  to: number; // the neighbourhood it goes to
  open: boolean;
  pole: THREE.Object3D; // the barrier, down while it's shut
  lift: number; // 0 down .. 1 up
  sign: THREE.Object3D; // the little building on top that says where it goes
}

/**
 * A gate across the east end of a street: two posts, an arch with bunting, a little model of a
 * building from the neighbourhood it leads to on top (no words), and a striped barrier pole that
 * lifts when it opens.
 */
function makeGate(scene: THREE.Scene, z: number, to: number, open: boolean): Gate {
  const g = new THREE.Group();
  const m = new Model();
  const Post = 0xf3e6c8, Brick = 0xc0573f;
  for (const pz of [-17, 15]) m.box(-1, 0, pz, 3, 24, 3, Brick).box(-2, 24, pz - 1, 5, 2, 5, Post);
  m.box(-1, 24, -16, 3, 2, 32, Post);
  const flags = [0xff5d8f, 0xffc93c, 0x4aa8ff, 0x3fb950, 0xc77dff];
  for (let k = 0; k < 10; k++) m.box(0, 21 - (k % 2), -14 + k * 3, 1, 2, 2, flags[k % flags.length]);
  const posts = m.mesh(Cell, [0, 0, 0]);
  g.add(posts);
  // The barrier: a red-and-white pole pivoting on the north post.
  const pole = new THREE.Group();
  const pm = new Model();
  for (let k = 0; k < 30; k++) pm.box(0, 0, k, 1, 1, 1, Math.floor(k / 3) % 2 ? 0xffffff : 0xd8382c);
  const poleMesh = pm.mesh(Cell, [0.5, 0.5, 0]);
  pole.add(poleMesh);
  pole.position.set(0.05, 0.9, -1.4);
  g.add(pole);
  const sign = B.assemble(B.HOODS[to].landmark);
  sign.scale.setScalar(0.22);
  sign.position.set(0.05, 2.6, 0);
  g.add(sign);
  g.position.set(GATE_X, 0, z);
  scene.add(g);
  return { z, to, open, pole, lift: open ? 1 : 0, sign };
}

function updateGate(g: Gate, dt: number, clock: number): void {
  g.lift += ((g.open ? 1 : 0) - g.lift) * (1 - Math.exp(-4 * dt));
  g.pole.rotation.x = g.lift * Math.PI * 0.45;
  g.sign.rotation.y = Math.sin(clock * 0.8) * 0.5 - Math.PI / 2;
}

/**
 * The edge of town, so the grass isn't one flat green: a little farm behind the first street (a
 * red barn, fields in rows, a tractor), wildflowers dotted through the grass, and gentle patches
 * of lighter and darker green.
 */
function buildCountryside(scene: THREE.Scene): void {
  const barn = M.barn().mesh(Cell, [0, 0, 0]);
  barn.position.set(18.5, 0, -20.5);
  scene.add(barn);
  for (const [x, z, crop] of [[6.5, -26, 0x7ec850], [6.5, -20.6, 0xd9c24a], [11.6, -26, 0x5fb35a]] as const) {
    const f = M.field(46, 42, crop).mesh(Cell, [0, 0, 0]);
    f.position.set(x, 0.002, z);
    f.receiveShadow = true;
    scene.add(f);
  }
  const t = M.tractor().mesh(Cell, [0, 0, 0]);
  t.position.set(13.5, 0, -16.5);
  t.rotation.y = Math.PI * 0.9;
  scene.add(t);

  const f = new Faces();
  const top = (n: [number, number, number]) => n[1] === 1;
  let seed = 23;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Patches of lighter and darker grass.
  for (let k = 0; k < 160; k++) {
    const x = -45 + rnd() * 90, z = -40 + rnd() * 80;
    const w = 0.8 + rnd() * 2.2, d = 0.6 + rnd() * 1.8;
    f.box(x, 0, z, w, 0.002, d, rnd() < 0.5 ? 0x8ad25c : 0x74bd4a, top);
  }
  // Wildflowers, in little clusters, out where nobody's built.
  const cols = [0xffffff, 0xffd34d, 0xff8fb8, 0xc77dff, 0xff7a5a];
  for (let k = 0; k < 90; k++) {
    let x = -40 + rnd() * 80, z = -32 + rnd() * 18;
    if (x > 4 && x < 25 && z > -28) x -= 30; // not in the farm's fields
    const c = cols[Math.floor(rnd() * cols.length)];
    for (let j = 0; j < 5; j++) f.box(x + rnd() * 0.8, 0, z + rnd() * 0.8, 0.1, 0.07, 0.1, c, (n) => n[1] !== -1);
  }
  const mesh = new THREE.Mesh(f.geometry(), voxelMaterial);
  mesh.position.y = -0.008;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

/**
 * The Harbour's seafront, where Home Street has its park: a promenade with a railing, a sandy beach
 * with umbrellas and beach huts, the sea out to the horizon, a wooden pier with a rowing boat, and
 * sailing boats bobbing out on the water.
 */
function buildHarbour(scene: THREE.Scene, anims: ((t: number) => void)[]): void {
  const f = new Faces();
  const top = (n: [number, number, number]) => n[1] === 1;
  const Z0 = ROAD_B + HALF + 1; // the back of the pavement
  // The promenade, then the sand.
  f.box(-40, 0, Z0, 80, 0.03, 1.6, 0xe4ddd0, top);
  f.box(-40, 0, Z0 + 1.6, 80, 0.02, 3.4, C.Sand, top);
  // Darker wet sand at the water's edge.
  f.box(-40, 0, Z0 + 4.6, 80, 0.015, 0.4, 0xc9a36a, top);
  const ground = new THREE.Mesh(f.geometry(), voxelMaterial);
  ground.receiveShadow = true;
  scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), new THREE.MeshLambertMaterial({ color: 0x4fb3e8 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.004, Z0 + 5 + 60);
  sea.receiveShadow = true;
  scene.add(sea);
  const shallows = new THREE.Mesh(new THREE.PlaneGeometry(200, 1.2), new THREE.MeshLambertMaterial({ color: 0x8fd6f5 }));
  shallows.rotation.x = -Math.PI / 2;
  shallows.position.set(0, 0.008, Z0 + 5.6);
  scene.add(shallows);

  // The railing along the promenade, with a gap onto the pier.
  const rail = new Model();
  for (let x = 0; x < 10; x += 3) rail.box(x, 0, 0, 1, 5, 1, C.White);
  rail.box(0, 4, 0, 10, 1, 1, C.White).box(0, 2, 0, 10, 1, 1, C.White);
  for (let x = -30; x < 30; x++) {
    if (x >= 5 && x < 8) continue;
    const r = rail.mesh(Cell, [0, 0, 0]);
    r.position.set(x, 0.03, Z0 + 1.5);
    scene.add(r);
  }

  // Beach umbrellas and beach huts on the sand, and a sandcastle.
  const umbrella = (c1: number, c2: number) => {
    const m = new Model();
    m.box(0, 0, 0, 1, 12, 1, C.White);
    for (let x = -6; x <= 6; x++)
      for (let z = -6; z <= 6; z++) {
        const d = Math.hypot(x, z);
        if (d > 6.5) continue;
        m.set(x, 12 - Math.floor(d / 3), z, Math.floor(Math.atan2(z, x) / (Math.PI / 4) + 8) % 2 ? c1 : c2);
      }
    m.box(3, 0, 2, 6, 1, 3, 0xffffff).box(3, 0, 2, 6, 1, 1, c1); // a towel
    return m;
  };
  [[-14, 0xd8382c, 0xffffff], [-2, 0x2f74d0, 0xffffff], [16, 0xffc93c, 0xff5d8f]].forEach(([x, c1, c2]) => {
    const u = umbrella(c1, c2).mesh(Cell, [0, 0, 0]);
    u.position.set(x, 0.02, Z0 + 3.3);
    scene.add(u);
  });
  const hut = (paint: number) => {
    const m = new Model();
    m.box(0, 0, 0, 10, 12, 8, C.White);
    for (let x = 0; x < 10; x += 2) m.box(x, 0, 8, 1, 12, 1, paint);
    m.box(3, 0, 8, 4, 8, 1, paint).box(4, 0, 8, 2, 7, 1, 0x3a3f47);
    for (let k = 0; k < 4; k++) m.box(-1 + k, 12 + k, -1, 12 - 2 * k, 1, 10, paint);
    return m;
  };
  [-24, -21.5, -19, 21, 23.5].forEach((x, k) => {
    const h = hut([0xff5d8f, 0x4aa8ff, 0xffc93c, 0x3fb950, 0xc77dff][k]).mesh(Cell, [5, 0, 4]);
    h.position.set(x, 0.02, Z0 + 2.2);
    h.rotation.y = Math.PI;
    scene.add(h);
  });
  const castle = new Model().box(0, 0, 0, 6, 3, 6, 0xe0c08a).box(1, 3, 1, 4, 2, 4, 0xe0c08a).box(2, 5, 2, 2, 2, 2, 0xe0c08a).box(2, 7, 2, 1, 2, 1, C.White).box(3, 8, 2, 2, 1, 1, 0xd8382c);
  const cm = castle.mesh(Cell, [3, 0, 3]);
  cm.position.set(-8, 0.02, Z0 + 3.4);
  scene.add(cm);

  // The pier: planks out over the water on posts, a rowing boat tied up at its end.
  const pier = new Model();
  for (let z = 0; z < 110; z++) pier.box(0, 0, z, 30, 1, 1, z % 2 ? 0x9a6a3c : 0xa8774a);
  for (let z = 10; z < 110; z += 20) pier.box(-1, -4, z, 2, 5, 2, 0x6b4a2b).box(29, -4, z, 2, 5, 2, 0x6b4a2b);
  for (let z = 4; z < 110; z += 6) pier.box(0, 1, z, 1, 4, 1, C.White).box(29, 1, z, 1, 4, 1, C.White);
  pier.box(0, 4, 0, 1, 1, 110, C.White).box(29, 4, 0, 1, 1, 110, C.White);
  const pm = pier.mesh(Cell, [0, 0, 0]);
  pm.position.set(5, 0.12, Z0 + 1.5);
  scene.add(pm);

  const boat = (hull: number, sail: number | null) => {
    const m = new Model();
    for (let x = -9; x <= 9; x++) {
      const half = Math.max(1, Math.round(4 * Math.sqrt(1 - (x / 10) ** 2)));
      m.box(x, 0, -half, 1, 2, 2 * half, hull).box(x, 2, -half, 1, 1, 2 * half, C.White);
      m.box(x, 2, -half + 1, 1, 1, 2 * half - 2, 0x9a6a3c);
    }
    if (sail !== null) {
      m.box(0, 3, 0, 1, 22, 1, C.Wood);
      for (let y = 0; y < 18; y++) m.box(1, 5 + y, 0, Math.max(1, Math.round((18 - y) * 0.5)), 1, 1, sail);
    }
    return m;
  };
  const rowing = boat(0xd8382c, null).mesh(Cell, [0, 0, 0]);
  rowing.position.set(4.2, 0, Z0 + 11.5);
  rowing.rotation.y = Math.PI / 2;
  scene.add(rowing);
  anims.push((t) => {
    rowing.position.y = 0.02 + Math.sin(t * 1.6) * 0.03;
    rowing.rotation.z = Math.sin(t * 1.3) * 0.04;
  });
  ([[-12, 10, 0x2f74d0, 0xffffff], [16, 13, 0xffc93c, 0xd8382c], [-26, 17, 0x3fb950, 0xfff4d6]] as const).forEach(([x, dz, hull, sail], k) => {
    const b = boat(hull, sail).mesh(Cell, [0, 0, 0]);
    b.position.set(x, 0, Z0 + dz);
    scene.add(b);
    anims.push((t) => {
      b.position.x = x + Math.sin(t * 0.12 + k * 2) * 3;
      b.position.y = Math.sin(t * 1.4 + k) * 0.04;
      b.rotation.x = Math.sin(t * 1.1 + k) * 0.05;
      b.rotation.y = Math.cos(t * 0.12 + k * 2) > 0 ? 0 : Math.PI;
    });
  });
}

/**
 * Market Square's middle, where Home Street has its park: a paved square with a fountain, a few
 * market stalls under striped canopies, trees in planters and benches.
 */
function buildSquare(scene: THREE.Scene, plant: (x: number, z: number) => void): void {
  const f = new Faces();
  const top = (n: [number, number, number]) => n[1] === 1;
  // Paving in a soft check.
  for (let x = -16; x < 16; x++)
    for (let z = 13; z < 22; z++) f.box(x, 0, z, 1, 0.02, 1, (x + z) % 2 ? 0xe4ddd0 : 0xd6cdbd, top);
  const paving = new THREE.Mesh(f.geometry(), voxelMaterial);
  paving.receiveShadow = true;
  scene.add(paving);
  // The fountain: a round basin, a column and a bowl, with water in both.
  const fm = new Model();
  for (let x = -14; x < 14; x++)
    for (let z = -14; z < 14; z++) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d <= 14 && d > 12) fm.box(x, 0, z, 1, 3, 1, 0xcfc8bb);
      else if (d <= 12) fm.set(x, 0, z, 0x6ec6f0).set(x, 1, z, 0x8fd6f5);
      if (d <= 2) fm.box(x, 2, z, 1, 8, 1, 0xcfc8bb);
      if (d <= 6 && d > 4.5) fm.box(x, 9, z, 1, 2, 1, 0xcfc8bb);
      if (d <= 4.5) fm.set(x, 9, z, 0xcfc8bb).set(x, 10, z, 0x8fd6f5);
    }
  fm.box(-1, 10, -1, 2, 3, 2, 0xbfe9fb);
  const fountain = fm.mesh(Cell, [0, 0, 0]);
  fountain.position.set(0, 0, 17.5);
  scene.add(fountain);
  // Market stalls: a counter, four posts and a striped canopy, each with something on the counter.
  const canopies: [number, number][] = [[0xd8382c, 0xffffff], [0x2f74d0, 0xffffff], [0x3fb950, 0xfff4d6], [0xffc93c, 0xffffff]];
  const goods = [0xff8a1f, 0xd8263a, 0x7ec850, 0xf6dc7a];
  [-12, -7, 7, 12].forEach((x, k) => {
    const s = new Model();
    s.box(0, 0, 0, 14, 7, 6, 0x9a6a3c).box(0, 7, 0, 14, 1, 6, 0xc98a3e);
    for (const [px, pz] of [[0, 0], [13, 0], [0, 9], [13, 9]]) s.box(px, 0, pz, 1, 16, 1, C.White);
    const [c1, c2] = canopies[k];
    for (let x2 = -1; x2 < 15; x2++) for (let z2 = -1; z2 < 11; z2++) s.set(x2, 16 + (z2 < 5 ? 1 : 0), z2, Math.floor(x2 / 2) % 2 ? c1 : c2);
    for (let x2 = 1; x2 < 13; x2 += 2) s.box(x2, 8, 1, 1, 1, 1, goods[(k + x2) % goods.length]).box(x2, 8, 3, 1, 1, 1, goods[(k + x2 + 1) % goods.length]);
    const mesh = s.mesh(Cell, [7, 0, 5]);
    mesh.position.set(x, 0, 15.2);
    mesh.rotation.y = Math.PI;
    scene.add(mesh);
  });
  // Trees in round planters at the corners, and benches facing the fountain.
  for (const [x, z] of [[-15, 20.5], [15, 20.5], [-3.5, 21], [3.5, 21]]) {
    const pm = new Model();
    for (let x2 = -4; x2 < 4; x2++) for (let z2 = -4; z2 < 4; z2++) if (Math.hypot(x2 + 0.5, z2 + 0.5) <= 4) pm.box(x2, 0, z2, 1, 3, 1, 0xb5523b).set(x2, 3, z2, 0x6b4a2b);
    const planter = pm.mesh(Cell, [0, 0, 0]);
    planter.position.set(x, 0, z);
    scene.add(planter);
    plant(x, z);
  }
  const bench = M.bench();
  for (const [x, z, r] of [[-3, 17.5, Math.PI / 2], [3, 17.5, -Math.PI / 2], [0, 20.5, 0]]) {
    const b = bench.mesh(Cell, [5, 0, 1.5]);
    b.position.set(x, 0, z);
    b.rotation.y = r;
    scene.add(b);
  }
  for (const [x, n] of [[-10, 30], [10, 30]]) {
    const fl = M.flowers(n, x).mesh(Cell, [n / 2, 0, 1.5]);
    fl.position.set(x, 0, 20.8);
    scene.add(fl);
  }
}

interface Lot {
  i: number;
  bp: B.Blueprint;
  x: number;
  front: number; // the footprint's front edge (z)
  fence: number; // the front fence line (z), just inside the pavement
  walk: number; // the middle of the pavement in front (z)
  roadZ: number;
  zone: Box; // the whole lot
  built: boolean;
  group: THREE.Group;
  ring: THREE.Mesh | null;
  mini: THREE.Group | null;
  people: Person[];
}

interface Person {
  mesh: THREE.Mesh;
  pos: THREE.Vector2;
  route: THREE.Vector2[];
  wait: number;
  speed: number;
  phase: number;
  wave: number; // > 0 while waving
  waveCooldown: number;
  lot: Lot;
  inside: boolean; // in the garden (or on the pavement)
  kind: Kind;
}

/** Who lives on the street: all sorts. A wheelchair user waves with a happy wheelie instead of a jump. */
type Kind = "adult" | "child" | "elder" | "wheel" | "dog";

export interface TownHooks {
  build(lot: number): void;
  /** Drove through a gate: off to neighbourhood `to`. */
  travel(to: number): void;
  controls(): Controls;
  hints(work: boolean, hop: boolean): void;
}

export interface TownMode extends Mode {
  readonly debug: Record<string, unknown>;
}

// ------------------------------------------------------------------ who lives here

/**
 * Households, not a random crowd: most homes are a mum and a dad with their children, the way most
 * children's homes are, and the rest are the other families a street has: grandparents, a single
 * mum or dad, a couple, a grandparent living with the family. Now and then someone uses a
 * wheelchair, or wears a headscarf. A family shares a skin tone and hair colour, so it reads as a
 * family. Picked the same way every time for a lot, so its people don't change between visits.
 */
type Who = "man" | "woman" | "boy" | "girl" | "grandpa" | "grandma";
const HOUSEHOLDS: Who[][] = [
  ["man", "woman", "boy", "girl"],
  ["man", "woman", "girl"],
  ["man", "woman", "boy"],
  ["man", "woman", "girl", "boy"],
  ["man", "woman", "boy", "boy"],
  ["man", "woman", "girl", "girl"],
  ["man", "woman", "boy", "girl"],
  ["man", "woman", "girl", "grandma"],
  ["grandpa", "grandma"],
  ["woman", "girl", "boy"],
  ["man", "boy"],
  ["man", "woman"],
];
const SKINS = [0xf6d3a6, 0xf1c7a0, 0xe8b98a, 0xe0ac7e, 0xc68a5b, 0x8d5a3b, 0x5e3b28];
const HAIRS = [0x2b2118, 0x5a3a22, 0x8a5a3c, 0xe0b040, 0xb5523b];
const SHIRTS = [0x4aa8ff, 0xff5d8f, 0x3fb950, 0xffc93c, 0xc77dff, 0xff8a1f, 0x6fd3b0, 0xf7b6c8, 0xd8382c, 0x2f74d0];
const PANTS = [0x3c4652, 0x2f3b52, 0x6b4a2b, 0x4a4f57];
const DOGS: [number, number][] = [[0xc98a3e, 0xf3e6c8], [0x3a3f47, 0xffffff], [0xf3e6c8, 0x9a6a3c]];

interface Resident {
  kind: Kind;
  model: Model;
}

function rng(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function household(who: Who[], r: () => number): Resident[] {
  const skin = SKINS[Math.floor(r() * SKINS.length)];
  const hair = HAIRS[Math.floor(r() * HAIRS.length)];
  const scarf = r() < 0.12; // mum wears a headscarf
  const wheel = r() < 0.12 ? Math.floor(r() * who.length) : -1; // someone uses a wheelchair
  return who.map((w, k) => {
    const look: M.Look = {
      skin,
      hair: w === "grandpa" || w === "grandma" ? (r() < 0.5 ? 0xe8e8e8 : 0xcfcfcf) : hair,
      shirt: SHIRTS[Math.floor(r() * SHIRTS.length)],
      pants: PANTS[Math.floor(r() * PANTS.length)],
      long: w === "woman" || w === "girl" || w === "grandma",
      dress: (w === "girl" && r() < 0.6) || (w === "woman" && r() < 0.4) || (w === "grandma" && r() < 0.6),
      scarf: w === "woman" && scarf ? SHIRTS[(k + 3) % SHIRTS.length] : undefined,
    };
    const grown = w !== "boy" && w !== "girl";
    if (k === wheel && grown) return { kind: "wheel", model: M.wheelchair({ ...look, dress: false }) };
    if (w === "grandpa" || w === "grandma") return { kind: "elder", model: M.elder(look) };
    if (!grown) return { kind: "child", model: M.person(look, true) };
    return { kind: "adult", model: M.person(look) };
  });
}

/** Who lives in (or is about) a building: its households, up to about seven people, and maybe a dog. */
function residents(hood: number, i: number, homes: number, playground = false): Resident[] {
  const r = rng(hood * 100 + i * 7 + 3);
  const pick = () => HOUSEHOLDS[Math.floor(r() * HOUSEHOLDS.length)];
  let people: Resident[] = [];
  if (playground) {
    // Two families out to play.
    people = [...household(["man", "woman", "girl", "boy"], r), ...household(["woman", "boy", "girl"], r)];
  } else if (homes === 0) {
    // A shop or a station: a couple of grown-ups about.
    people = household(["man", "woman"], r);
  } else {
    for (let h = 0; h < homes; h++) {
      const next = household(h === 0 ? pick() : pick(), r);
      if (h > 0 && people.length + next.length > 7) break;
      people.push(...next);
    }
  }
  if (homes > 0 && r() < 0.5) people.push({ kind: "dog", model: M.dog(...DOGS[Math.floor(r() * DOGS.length)]) });
  return people;
}

const SPEED: Record<Kind, number> = { adult: 0.8, child: 1.1, elder: 0.45, wheel: 0.9, dog: 1.4 };

export function createTown(
  hood: number,
  built: Set<number>,
  arrived: number | null,
  via: "next" | "back" | null,
  looksOf: (lot: number) => B.Looks | undefined,
  hooks: TownHooks,
): TownMode {
  const H = B.HOODS[hood];
  const nextHood = hood + 1 < B.HOODS.length ? hood + 1 : null;
  const backHood = hood > 0 ? hood - 1 : null;
  // A street with a gate runs on east to it; one without stops at the side road.
  const END_A = nextHood !== null ? GATE_X + 0.6 : SIDE_X + HALF;
  const END_B = backHood !== null ? GATE_X + 0.6 : SIDE_X + HALF;
  const { scene, camera, frame: frameCamera } = lit();
  const fx = new Fx(scene);
  const marker = new Marker(scene);
  const workPrompt = new Prompt(scene, 1.15);
  const pops = new Pops();

  // ------------------------------------------------------------------ the ground: grass, roads, pavements

  const ground: Ground & { boxes: Box[]; circles: Circle[] } = {
    boxes: [
      { minX: -60, maxX: 60, minZ: -60, maxZ: ROAD_A - HALF }, // north of the first street
      { minX: -SIDE_X + HALF, maxX: SIDE_X - HALF, minZ: ROAD_A + HALF, maxZ: ROAD_B - HALF }, // between the streets
      { minX: -60, maxX: 60, minZ: ROAD_B + HALF, maxZ: 60 }, // south of the second
      { minX: -60, maxX: -SIDE_X - HALF, minZ: -60, maxZ: 60 },
      // East: the two streets run on out to the gates, and stop there.
      { minX: SIDE_X + HALF, maxX: 60, minZ: ROAD_A + HALF, maxZ: ROAD_B - HALF },
      { minX: END_A, maxX: 60, minZ: ROAD_A - HALF, maxZ: ROAD_A + HALF },
      { minX: END_B, maxX: 60, minZ: ROAD_B - HALF, maxZ: ROAD_B + HALF },
    ],
    circles: [],
    heightAt: () => 0,
  };

  {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ color: C.Grass }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.01;
    grass.receiveShadow = true;
    scene.add(grass);

    const f = new Faces();
    const Road = 0x5d636b, Line = 0xf4f4f4, Walk = 0xdcd6cb, Curb = 0xb3ada3;
    const top = (n: [number, number, number]) => n[1] === 1;
    // The two streets and the side roads joining them.
    for (const [z, end] of [[ROAD_A, END_A], [ROAD_B, END_B]]) f.box(-SIDE_X - HALF, 0, z - HALF, end + 0.4 + SIDE_X + HALF, 0.012, 2 * HALF, Road, top);
    for (const x of [-SIDE_X, SIDE_X]) f.box(x - HALF, 0, ROAD_A + HALF, 2 * HALF, 0.012, ROAD_B - ROAD_A - 2 * HALF, Road, top);
    // Dashes down the middles.
    for (const z of [ROAD_A, ROAD_B])
      for (let x = -SIDE_X + 1; x < SIDE_X - 1; x += 1.4) f.box(x, 0.013, z - 0.06, 0.7, 0, 0.12, Line, top);
    for (const x of [-SIDE_X, SIDE_X])
      for (let z = ROAD_A + HALF + 0.4; z < ROAD_B - HALF - 0.6; z += 1.4) f.box(x - 0.06, 0.013, z, 0.12, 0, 0.7, Line, top);
    // Pavements, a little raised, along both sides of both streets: square paving slabs with
    // joints between them (a few a shade different), and a row of kerb stones along the road edge.
    const Joint = 0xb9b2a6, Walk2 = 0xd3ccbf, Kerb = 0xe6e1d8;
    const walk = (x0: number, x1: number, z0: number, z1: number, roadAtMin: boolean) => {
      f.box(x0, 0, z0, x1 - x0, 0.06, z1 - z0, Joint, (n) => n[1] !== -1, Curb);
      const kz = roadAtMin ? z0 : z1 - 0.16;
      const s0 = roadAtMin ? z0 + 0.16 : z0;
      for (let x = x0; x < x1 - 0.01; x += 0.5)
        for (let z = s0; z < s0 + (z1 - z0 - 0.16) - 0.01; z += 0.42) {
          const odd = (Math.round(x * 2) * 7 + Math.round(z * 3)) % 9 === 0;
          f.box(x + 0.025, 0.06, z + 0.02, 0.45, 0.012, 0.38, odd ? Walk2 : Walk, (n) => n[1] === 1);
        }
      for (let x = x0; x < x1 - 0.01; x += 1) f.box(x + 0.02, 0, kz, 0.96, 0.085, 0.16, Kerb, (n) => n[1] !== -1, 0xc9c3b8);
    };
    walk(-SIDE_X + HALF, SIDE_X - HALF, ROAD_A - HALF - 1, ROAD_A - HALF, false);
    walk(-SIDE_X + HALF, SIDE_X - HALF, ROAD_A + HALF, ROAD_A + HALF + 1, true);
    walk(-SIDE_X + HALF, SIDE_X - HALF, ROAD_B - HALF - 1, ROAD_B - HALF, false);
    walk(-SIDE_X - HALF, SIDE_X + HALF, ROAD_B + HALF, ROAD_B + HALF + 1, true);
    const mesh = new THREE.Mesh(f.geometry(), voxelMaterial);
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Street lamps along the pavements, between the lots.
    const lamp = M.lamp();
    for (const x of [-16, -8, 0, 8, 16])
      for (const z of [ROAD_A - HALF - 0.3, ROAD_B + HALF + 0.3]) {
        const l = lamp.mesh(Cell, [0, 0, 0]);
        l.position.set(x, 0.07, z);
        scene.add(l);
      }
  }

  // ------------------------------------------------------------------ trees, the park and the crew's yard

  /** Little things that move on their own (boats bobbing), run every frame with the clock. */
  const anims: ((t: number) => void)[] = [];
  {
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const trees = [M.tree(0), M.tree(1)];
    const plant = (x: number, z: number) => {
      // Not on the streets running out east to the gates, or round the gates themselves.
      if (x > SIDE_X && x < GATE_X + 3.5 && (Math.abs(z - ROAD_A) < 3 || Math.abs(z - ROAD_B) < 3)) return;
      if (H.theme === "harbour" && z > ROAD_B + 2.5) return; // that's the beach and the sea
      if (x > 4 && x < 25 && z < -14 && z > -28) return; // the farm
      const t = trees[Math.floor(rnd() * 2)].mesh(Cell);
      t.position.set(x, 0, z);
      t.rotation.y = rnd() * Math.PI;
      t.scale.setScalar(0.9 + rnd() * 0.5);
      scene.add(t);
    };
    for (let k = 0; k < 40; k++) plant(-30 + rnd() * 60, -16 - rnd() * 12); // behind the first street
    buildCountryside(scene);
    for (let k = 0; k < 16; k++) plant(22 + rnd() * 10, -14 + rnd() * 34); // east
    for (let k = 0; k < 10; k++) plant(-31.5 - rnd() * 6, -14 + rnd() * 34); // west, beyond the yard
    for (let k = 0; k < 14; k++) plant(-30 + rnd() * 60, 24 + rnd() * 8); // beyond the park
    if (H.theme === "square") {
      buildSquare(scene, plant);
    } else if (H.theme === "harbour") {
      buildHarbour(scene, anims);
    } else {
    // The park: trees round the edge, a pond, benches and flowers.
    for (const [x, z] of [[-15, 15], [-11, 19], [-6, 16.2], [9, 15.5], [14, 18.5], [17, 15], [-17, 20], [2, 21]]) plant(x, z);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshLambertMaterial({ color: 0x6ec6f0 }));
    pond.rotation.x = -Math.PI / 2;
    pond.scale.set(3.2, 2, 1);
    pond.position.set(3, 0.01, 17.5);
    pond.receiveShadow = true;
    scene.add(pond);
    const edge = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 40), new THREE.MeshLambertMaterial({ color: 0xdcd6cb }));
    edge.rotation.x = -Math.PI / 2;
    edge.scale.set(3.2, 2, 1);
    edge.position.set(3, 0.015, 17.5);
    scene.add(edge);
    const bench = M.bench();
    for (const [x, z] of [[-3, 15.2], [8.5, 15.2], [-9, 15.2]]) {
      const b = bench.mesh(Cell, [5, 0, 1.5]);
      b.position.set(x, 0, z);
      b.rotation.y = Math.PI;
      scene.add(b);
    }
    for (const [x, z, n] of [[-8, 17.5, 30], [11, 17, 40], [-2, 20, 24]]) {
      const fl = M.flowers(n, x).mesh(Cell, [n / 2, 0, 1.5]);
      fl.position.set(x, 0, z);
      scene.add(fl);
    }
    // A duck. (Every pond needs one.)
    const duck = new Model().box(-2, 0, -1, 4, 2, 3, 0xffffff).box(1, 2, -1, 2, 2, 2, 0xffffff).box(3, 2, -1, 1, 1, 2, 0xff8a1f).set(2, 3, -1, C.Black);
    const d = duck.mesh(Cell, [0, 0, 0.5]);
    d.position.set(2, 0.01, 17.2);
    d.name = "duck";
    scene.add(d);
    }
  }

  // ------------------------------------------------------------------ the gates to the other neighbourhoods

  const gates: Gate[] = [];
  if (nextHood !== null) gates.push(makeGate(scene, ROAD_A, nextHood, built.size >= H.lots.length));
  if (backHood !== null) gates.push(makeGate(scene, ROAD_B, backHood, true));

  // The crew's yard, west of the side road: the machines that do the building, parked.
  const yardMachines: Machine[] = [
    new Excavator(new THREE.Vector2(-23.5, 0.5)),
    new Mixer(new THREE.Vector2(-23.5, 3.2)),
    new Roller(new THREE.Vector2(-23.5, 5.8)),
    new Crane(new THREE.Vector2(-23.5, 8.4)),
  ];
  {
    // The yard: packed gravel with a concrete edge, painted bays for the machines, the crew's
    // cabin and tool container at the back, and stacks of pipes and bricks waiting to go out.
    const f = new Faces();
    const top = (n: [number, number, number]) => n[1] === 1;
    const Y = YARD;
    f.box(Y.minX - 0.25, 0, Y.minZ - 0.25, Y.maxX - Y.minX + 0.5, 0.05, Y.maxZ - Y.minZ + 0.5, 0xc9c5bc, (n) => n[1] !== -1, 0xa8a49b);
    f.box(Y.minX, 0.05, Y.minZ, Y.maxX - Y.minX, 0.004, Y.maxZ - Y.minZ, 0xb5a283, top);
    let seed = 41;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 220; k++) {
      const x = Y.minX + rnd() * (Y.maxX - Y.minX - 0.12), z = Y.minZ + rnd() * (Y.maxZ - Y.minZ - 0.12);
      f.box(x, 0.055, z, 0.06 + rnd() * 0.08, 0.003, 0.06 + rnd() * 0.08, rnd() < 0.5 ? 0x9c8a6d : 0xcdbb98, top);
    }
    // White bay lines between the parked machines.
    for (const z of [-0.85, 1.85, 4.5, 7.1, 9.8]) f.box(-25.6, 0.056, z - 0.05, 3.6, 0.003, 0.1, 0xf4f4f4, top);
    // Tyre tracks out to the road.
    for (const z of [0.2, 0.8, 8.1, 8.7]) f.box(-22, 0.056, z, 1.5, 0.003, 0.18, 0x8f7d61, top);
    const yard = new THREE.Mesh(f.geometry(), voxelMaterial);
    yard.receiveShadow = true;
    scene.add(yard);
    const office = M.office().mesh(Cell, [15, 0, 10]);
    office.position.set(-28.9, 0, 6.2);
    office.rotation.y = Math.PI / 2;
    scene.add(office);
    const box = M.container(0x3f9a45).mesh(Cell, [20, 0, 8]);
    box.position.set(-28.9, 0, 1.4);
    box.rotation.y = -Math.PI / 2;
    scene.add(box);
    const pipes = M.pipeStack().mesh(Cell, [10, 0, 0]);
    pipes.position.set(-29, 0, 9.9);
    scene.add(pipes);
    for (const [x, z] of [[-26.6, 9.8], [-26.6, -1.2]]) {
      const b = M.bricks().mesh(Cell, [0, 0, 0]);
      b.position.set(x, 0.05, z);
      scene.add(b);
    }
    const w: World = { site: ground, machines: [] };
    for (const m of yardMachines) {
      scene.add(m.root);
      m.place(m.home.x, m.home.y, 0, ground);
      m.update(0, w);
      if (m instanceof Crane) m.attachTo(scene);
    }
    const cone = M.cone();
    for (const [x, z] of [[-20.8, -1.4], [-20.8, 10.4], [-27.6, 4.3], [-27.9, 4.0], [-27.3, 4.0]]) {
      const c = cone.mesh(Cell, [0, 0, 0]);
      c.position.set(x, 0.05, z);
      scene.add(c);
    }
  }

  // The pile of building materials in the yard, and the ring on the road beside it to load up at.
  const PILE = new THREE.Vector3(-21.3, 0, 4.5);
  // By the kerb on the yard side, so the traffic can get past while the truck loads.
  const LOAD_AT = new THREE.Vector2(-SIDE_X - 0.75, 4.5);
  {
    const pile = new THREE.Group();
    const cargo = M.cargo(), crate = M.crate();
    for (const [dx, dz, y] of [[0, -0.4, 0], [0, 0.35, 0], [0, -0.4, 0.5]]) {
      const m = cargo.mesh(Cell, [2.5, 0, 3]);
      m.position.set(dx, y, dz);
      pile.add(m);
    }
    for (const [dx, dz, y] of [[0.05, 0.3, 0.5], [0.1, 0.1, 0.8], [-0.25, 0.45, 0.5]]) {
      const m = crate.mesh(Cell, [1.5, 0, 1.5]);
      m.position.set(dx, y, dz);
      pile.add(m);
    }
    pile.position.copy(PILE);
    scene.add(pile);
  }
  // The yard's forklift, waiting by the pile to load the truck.
  const FORK_HOME = new THREE.Vector3(-20.2, 0, 4.5);
  const fork = new THREE.Group();
  fork.add(M.forkliftBody().mesh(Cell, [0, 0, 0]));
  const forks = new THREE.Group();
  forks.add(M.forkliftForks().mesh(Cell, [0, 0, 0]));
  forks.position.set(0.6, 0.12, 0);
  fork.add(forks);
  fork.position.copy(FORK_HOME);
  scene.add(fork);
  const loadRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.2, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  loadRing.rotation.x = -Math.PI / 2;
  loadRing.position.set(LOAD_AT.x, 0.03, LOAD_AT.y);
  scene.add(loadRing);

  // ------------------------------------------------------------------ the lots

  const lots: Lot[] = H.lots.map((bp, i) => {
    const row1 = i < 4;
    const x = COLS[i % 4];
    const front = row1 ? ROAD_A - HALF - 3 : ROAD_B - HALF - 3.5;
    const fence = row1 ? ROAD_A - HALF - 1.1 : ROAD_B - HALF - 1.1;
    const walk = row1 ? ROAD_A - HALF - 0.5 : ROAD_B - HALF - 0.5;
    const zone: Box = row1
      ? { minX: x - 3.8, maxX: x + 3.8, minZ: front - bp.d - 2.5, maxZ: fence }
      : { minX: x - 3.8, maxX: x + 3.8, minZ: ROAD_A + HALF + 1.1, maxZ: fence };
    const group = new THREE.Group();
    scene.add(group);
    return { i, bp, x, front, fence, walk, roadZ: row1 ? ROAD_A : ROAD_B, zone, built: false, group, ring: null, mini: null, people: [] };
  });

  const ringGeo = new THREE.RingGeometry(0.95, 1.2, 48);

  function clearLot(l: Lot): void {
    for (const p of l.people) scene.remove(p.mesh);
    l.people = [];
    if (l.ring) scene.remove(l.ring);
    l.ring = null;
    l.mini = null;
    l.group.clear();
  }

  /** An empty lot: sand, barriers along the front, and the little model on its stand. */
  function emptyLot(l: Lot): void {
    clearLot(l);
    l.built = false;
    const f = new Faces();
    f.box(l.zone.minX + 0.1, 0, l.zone.minZ, l.zone.maxX - l.zone.minX - 0.2, 0.008, l.zone.maxZ - l.zone.minZ, C.Sand, (n) => n[1] === 1);
    const sand = new THREE.Mesh(f.geometry(), voxelMaterial);
    sand.receiveShadow = true;
    l.group.add(sand);
    const bar = M.barrier();
    for (const dx of [-3.6, -2.6, 1.6, 2.6]) {
      const b = bar.mesh(Cell);
      b.position.set(l.x + dx, 0, l.fence - 0.05);
      l.group.add(b);
    }
    const stand = new THREE.Group();
    const plinth = M.plinth().mesh(Cell, [0, 0, 0]);
    plinth.scale.setScalar(1.7);
    stand.add(plinth);
    const mini = B.assemble(l.bp);
    mini.scale.setScalar(0.3);
    mini.position.y = 0.52;
    stand.add(mini);
    // Up near the front fence, so the model's close to the ring on the road where you stop.
    stand.position.set(l.x, 0, l.fence - 1.1);
    l.group.add(stand);
    l.mini = stand;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(l.x, 0.03, l.roadZ);
    scene.add(ring);
    l.ring = ring;
  }

  /** A built lot: lawn, the building, a path to the gate, a fence, flowers and the people who live there. */
  function builtLot(l: Lot): THREE.Group {
    clearLot(l);
    l.built = true;
    const bp = B.recolour(l.bp, looksOf(l.i)); // in the colours picked for it
    const f = new Faces();
    f.box(l.zone.minX + 0.1, 0, l.zone.minZ, l.zone.maxX - l.zone.minX - 0.2, 0.006, l.zone.maxZ - l.zone.minZ, 0x8fd65e, (n) => n[1] === 1);
    // The paved path, door to gate.
    for (let z = l.front; z < l.fence - 0.01; z += 0.5)
      for (let x = -0.75; x < 0.74; x += 0.5) {
        f.box(l.x + x, 0, z, 0.5, 0.03, Math.min(0.5, l.fence - z), 0x8d939a, (n) => n[1] === 1);
        f.box(l.x + x + 0.03, 0.031, z + 0.03, 0.44, 0, Math.min(0.5, l.fence - z) - 0.06, 0xc3c7cc, (n) => n[1] === 1);
      }
    const lawn = new THREE.Mesh(f.geometry(), voxelMaterial);
    lawn.receiveShadow = true;
    l.group.add(lawn);

    const house = B.assemble(bp);
    house.position.set(l.x, 0, l.front - bp.d / 2);
    l.group.add(house);

    // The fence along the front, with a gap for the path, and a mailbox by the gate.
    const pick = M.picket();
    for (let x = -3.7; x < 3.7 - 0.01; x += 1) {
      if (x > -1.2 && x < 0.8) continue;
      const p = pick.mesh(Cell);
      p.position.set(l.x + x, 0, l.fence - 0.1);
      l.group.add(p);
    }
    const mb = M.mailbox(bp.colour).mesh(Cell, [0.5, 0, 0.5]);
    mb.position.set(l.x + 1.2, 0, l.fence - 0.35);
    mb.rotation.y = -Math.PI / 2;
    l.group.add(mb);
    // Flowers along the front wall, leaving room for the path and every door's ramp, and a bush at each corner.
    const hw = bp.w / 2;
    const gaps = [[-0.85, 0.85], ...B.frontDoors(bp).map((x) => [x - 0.5, x + 0.5])].sort((p, q) => p[0] - q[0]);
    const beds: [number, number][] = [];
    let from = -hw + 0.1;
    for (const [g0, g1] of gaps) {
      if (g0 > from) beds.push([from, g0]);
      from = Math.max(from, g1);
    }
    if (hw - 0.1 > from) beds.push([from, hw - 0.1]);
    for (const [x0, x1] of beds) {
      const n = Math.round((x1 - x0) * 10);
      if (n < 4) continue;
      const fl = M.flowers(n, l.i * 3 + Math.round(x0)).mesh(Cell, [0, 0, 0]);
      fl.position.set(l.x + x0, 0, l.front + 0.05);
      l.group.add(fl);
    }
    for (const dx of [-3.2, 3.2]) {
      const b = M.bush(l.i % 2).mesh(Cell, [0, 0, 0]);
      b.position.set(l.x + dx, 0, l.fence - 0.6);
      l.group.add(b);
    }
    gardens(l, bp);

    // Who lives here.
    residents(hood, l.i, bp.homes, bp.kind === "playground").forEach(({ kind, model }, k) => {
      const mesh = model.mesh(M.WorkerCell, [0, 0, 0.5]);
      const pos = new THREE.Vector2(l.x - 1.6 + k * 0.45, l.front + 1.0 + (k % 2) * 0.3);
      mesh.position.set(pos.x, 0, pos.y);
      scene.add(mesh);
      l.people.push({ mesh, pos, route: [], wait: 0.5 + k * 1.1, speed: SPEED[kind], phase: k * 2, wave: 0, waveCooldown: 0, lot: l, inside: true, kind });
    });
    return house;
  }

  /**
   * The rest of a garden: a hedge down each side and along the back, and a couple of the things
   * families keep in their gardens (a tree, a shed, a washing line, a vegetable patch, a trampoline),
   * out the back if there's room, otherwise down the sides.
   */
  function gardens(l: Lot, bp: B.Blueprint): void {
    const r = rng(hood * 31 + l.i * 17 + 5);
    const seg = M.hedge(10);
    const back = l.zone.minZ + 0.15;
    for (const side of [-1, 1])
      for (let z = back + 1; z <= l.fence - 0.25; z += 1) {
        const h = seg.mesh(Cell, [0, 0, 1]);
        h.rotation.y = Math.PI / 2;
        h.position.set(l.x + side * 3.72, 0, z);
        l.group.add(h);
      }
    for (let x = l.x - 3.7; x < l.x + 3.69; x += 1) {
      const h = seg.mesh(Cell, [0, 0, 0]);
      h.position.set(x, 0, back);
      l.group.add(h);
    }
    const kinds = ["tree", "shed", "line", "veg", "tramp", "tree"];
    const pickKind = () => kinds[Math.floor(r() * kinds.length)];
    const houseBack = l.front - bp.d;
    const depth = houseBack - back;
    const sideW = 3.6 - bp.w / 2 - 0.2;
    const spots: [number, number, boolean][] = [];
    if (depth > 1.3) spots.push([l.x - 1.8, (back + houseBack) / 2, false], [l.x + 1.8, (back + houseBack) / 2, false]);
    else if (sideW > 0.9) {
      const dx = bp.w / 2 + 0.2 + sideW / 2;
      spots.push([l.x - dx, l.front - bp.d / 2, true], [l.x + dx, l.front - bp.d / 2, true]);
    }
    const shedPaints = [0x9ad9b5, 0x8fc8f0, 0xf6dc7a, 0xb9a6e6];
    for (const [x, z, side] of spots) {
      const kind = pickKind();
      let mesh: THREE.Mesh;
      if (kind === "tree") {
        mesh = M.tree(Math.floor(r() * 2)).mesh(Cell);
        mesh.scale.setScalar(0.75);
      } else if (kind === "shed") mesh = M.shed(shedPaints[Math.floor(r() * shedPaints.length)]).mesh(Cell, [0, 0, 0]);
      else if (kind === "line") {
        mesh = M.washingLine(l.i).mesh(Cell, [12, 0, 0]);
        if (side) mesh.rotation.y = Math.PI / 2;
      } else if (kind === "veg") mesh = M.vegPatch(14, 10).mesh(Cell, [7, 0, 5]);
      else mesh = M.trampoline().mesh(Cell, [0, 0, 0]);
      mesh.position.set(x, 0, z);
      l.group.add(mesh);
    }
  }

  for (const l of lots) {
    if (built.has(l.i)) builtLot(l);
    else emptyLot(l);
  }

  // Grass tufts, wildflowers, bushes and rocks over all the open grass round the town.
  {
    const avoid: Rect[] = [
      ...lots.map((l) => ({ minX: l.zone.minX - 0.2, maxX: l.zone.maxX + 0.2, minZ: l.zone.minZ - 0.3, maxZ: l.zone.maxZ + 0.2 })),
      { minX: -SIDE_X - HALF - 1.2, maxX: END_A + 1.5, minZ: ROAD_A - HALF - 1.3, maxZ: ROAD_A + HALF + 1.3 },
      { minX: -SIDE_X - HALF - 1.2, maxX: END_B + 1.5, minZ: ROAD_B - HALF - 1.3, maxZ: ROAD_B + HALF + 1.3 },
      { minX: -SIDE_X - HALF - 0.3, maxX: -SIDE_X + HALF + 0.3, minZ: ROAD_A, maxZ: ROAD_B },
      { minX: SIDE_X - HALF - 0.3, maxX: SIDE_X + HALF + 0.3, minZ: ROAD_A, maxZ: ROAD_B },
      { minX: YARD.minX - 0.5, maxX: YARD.maxX + 0.5, minZ: YARD.minZ - 0.5, maxZ: YARD.maxZ + 0.5 }, // the yard
      { minX: 4, maxX: 25, minZ: -28, maxZ: -14 }, // the farm
      { minX: GATE_X - 1, maxX: GATE_X + 1, minZ: ROAD_A - 2.5, maxZ: ROAD_B + 2.5 }, // the gates
      // The park, the square, or the beach and the sea.
      H.theme === "harbour" ? { minX: -60, maxX: 60, minZ: ROAD_B + HALF + 1, maxZ: 80 }
      : H.theme === "square" ? { minX: -17, maxX: 17, minZ: 12.5, maxZ: 22.5 }
      : { minX: -0.8, maxX: 6.8, minZ: 15, maxZ: 20 }, // the pond
    ];
    scatterFlora(scene, { minX: -42, maxX: 42, minZ: -38, maxZ: 34 }, avoid, 1600, 7 + hood * 13);
  }

  // ------------------------------------------------------------------ the people

  /** Somewhere to wander to: in the front garden, or now and then out along the pavement (via the gate). */
  function nextRoute(p: Person): void {
    const l = p.lot;
    const gateIn = new THREE.Vector2(l.x - 0.2, l.fence - 0.4);
    const gateOut = new THREE.Vector2(l.x - 0.2, l.walk);
    const out = Math.random() < 0.3;
    const dest = out
      ? new THREE.Vector2(l.x + (Math.random() - 0.5) * 7, l.walk + (Math.random() - 0.5) * 0.4)
      : new THREE.Vector2(l.x + (Math.random() - 0.5) * 6.4, l.front + 0.35 + Math.random() * (l.fence - l.front - 0.85));
    p.route = [];
    if (out !== !p.inside) p.route.push(p.inside ? gateIn : gateOut, p.inside ? gateOut : gateIn);
    p.route.push(dest);
    p.inside = !out;
  }

  let helloStep = 0;
  function updatePeople(dt: number, truck: THREE.Vector2): void {
    for (const l of lots)
      for (const p of l.people) {
        p.phase += dt;
        p.waveCooldown -= dt;
        const toTruck = Math.hypot(truck.x - p.pos.x, truck.y - p.pos.y);
        if (p.wave <= 0 && p.waveCooldown <= 0 && toTruck < 4 && l.built) {
          p.wave = 1.2;
          p.waveCooldown = 8;
          Audio.hello(helloStep++);
        }
        let y = 0;
        if (p.wave > 0) {
          // Turn to the truck and give a happy little jump or two.
          p.wave -= dt;
          p.mesh.rotation.y = Math.atan2(-(truck.y - p.pos.y), truck.x - p.pos.x);
          const bounce = Math.abs(Math.sin((1.2 - p.wave) * Math.PI * 2.5));
          if (p.kind === "wheel") p.mesh.rotation.z = bounce * 0.3; // a wheelie
          else y = bounce * (p.kind === "dog" ? 0.12 : 0.18);
        } else if (p.wait > 0) {
          p.mesh.rotation.z = 0;
          p.wait -= dt;
          if (p.wait <= 0 && p.route.length === 0) nextRoute(p);
        } else if (p.route.length) {
          const t = p.route[0];
          const d = t.clone().sub(p.pos);
          const len = d.length();
          const step = p.speed * dt;
          if (len <= step) {
            p.pos.copy(t);
            p.route.shift();
            if (!p.route.length) p.wait = 1 + Math.random() * 3;
          } else {
            p.pos.addScaledVector(d, step / len);
            p.mesh.rotation.y = Math.atan2(-d.y, d.x);
          }
          p.mesh.rotation.z = 0;
          // Walkers bob as they step; wheels roll smoothly.
          if (p.kind !== "wheel") y = Math.abs(Math.sin(p.phase * (p.kind === "dog" ? 14 : 9))) * (p.kind === "dog" ? 0.03 : 0.05);
        } else p.wait = 1;
        const onWalk = Math.abs(p.pos.y - l.walk) < 0.6;
        p.mesh.position.set(p.pos.x, y + (onWalk ? 0.07 : 0), p.pos.y);
      }
  }

  // ------------------------------------------------------------------ the truck

  const truck = new Truck(new THREE.Vector2(-SIDE_X - 0.8, 8.6));
  scene.add(truck.root);
  truck.driven = true;
  const world: World = { site: ground, machines: [truck] };
  const arrivedLot = arrived !== null ? lots[arrived] : null;
  if (arrivedLot) truck.place(arrivedLot.x - 2.6, arrivedLot.roadZ, 0, ground);
  else if (via) truck.place(GATE_X - 2.4, via === "next" ? ROAD_A : ROAD_B, Math.PI, ground);
  else truck.place(truck.home.x, truck.home.y, Math.PI / 2, ground);

  // ------------------------------------------------------------------ traffic: a couple of cars and the bus

  const cars: Car[] = [];
  ([[0, 0.15, M.car(0xd8382c)], [1, 0.55, M.car(0x4aa8ff, 0xf6dc7a)], [2, 0.6, M.bus()]] as const).forEach(([k, along, model]) => {
    const isBus = k === 2;
    const a = LOOP[k % 4], b = LOOP[(k + 1) % 4];
    const pos = a.clone().lerp(b, along);
    const mesh = model.mesh(Cell, [0, 0, 0]);
    scene.add(mesh);
    const len = isBus ? 1.5 : 0.85;
    const circles: Circle[] = [-len * 0.5, len * 0.5].map(() => ({ x: pos.x, z: pos.y, r: 0.5 }));
    ground.circles.push(...circles);
    cars.push({ mesh, pos, heading: Math.atan2(-(b.y - a.y), b.x - a.x), speed: CAR_SPEED, next: (k + 1) % 4, len, circles });
  });

  /**
   * Cars follow the loop at a gentle speed and always stop for the truck (and for each other): if
   * anything's just ahead in their lane, they wait until it's gone. They never back up or go round.
   */
  function updateCars(dt: number): void {
    for (const c of cars) {
      const target = LOOP[c.next];
      const to = target.clone().sub(c.pos);
      if (to.length() < 1.3) c.next = (c.next + 1) % LOOP.length;
      const want = Math.atan2(-to.y, to.x);
      const off = wrap(want - c.heading);
      const step = 2.2 * dt;
      c.heading = wrap(c.heading + Math.max(-step, Math.min(step, off)));
      const fwd = new THREE.Vector2(Math.cos(c.heading), -Math.sin(c.heading));
      const blocked = (p: THREE.Vector2, reach: number, width: number) => {
        const rel = p.clone().sub(c.pos);
        const ahead = rel.dot(fwd);
        const side = Math.abs(rel.x * fwd.y - rel.y * fwd.x);
        return ahead > -0.3 && ahead < reach && side < width;
      };
      let stop = blocked(truck.pos, c.len + 2.6, 1.05);
      for (const o of cars) if (o !== c && blocked(o.pos, c.len + o.len + 0.9, 0.9)) stop = true;
      const goal = stop ? 0 : CAR_SPEED;
      c.speed = c.speed > goal ? Math.max(goal, c.speed - 7 * dt) : Math.min(goal, c.speed + 1.8 * dt);
      c.pos.addScaledVector(fwd, c.speed * dt);
      c.mesh.position.set(c.pos.x, 0, c.pos.y);
      c.mesh.rotation.y = c.heading;
      c.circles.forEach((ci, i) => {
        const o = (i === 0 ? -0.5 : 0.5) * c.len;
        ci.x = c.pos.x + fwd.x * o;
        ci.z = c.pos.y + fwd.y * o;
      });
    }
  }

  // ------------------------------------------------------------------ evening, once a street's all built

  /**
   * When every lot here is built, the light turns to a warm golden evening and the street lamps
   * come on: a cosy reward, never dark.
   */
  const hemi = scene.children.find((o): o is THREE.HemisphereLight => o instanceof THREE.HemisphereLight)!;
  const sun = scene.children.find((o): o is THREE.DirectionalLight => o instanceof THREE.DirectionalLight)!;
  const DAY = { sky: new THREE.Color(0xa9dcff), sun: new THREE.Color(0xfff6e6), hemi: new THREE.Color(0xdfefff), ground: new THREE.Color(0x6a7a40) };
  const DUSK = { sky: new THREE.Color(0xffbf94), sun: new THREE.Color(0xffa860), hemi: new THREE.Color(0xffd2b0), ground: new THREE.Color(0x6a5a50) };
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
  const poolMat = new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const glowGeo = new THREE.BoxGeometry(0.26, 0.12, 0.26);
  const poolGeo = new THREE.CircleGeometry(0.85, 24);
  for (const x of [-16, -8, 0, 8, 16])
    for (const z of [ROAD_A - HALF - 0.3, ROAD_B + HALF + 0.3]) {
      const g = new THREE.Mesh(glowGeo, glowMat);
      g.position.set(x + 0.05, 0.07 + 1.52, z + 0.05);
      scene.add(g);
      const p = new THREE.Mesh(poolGeo, poolMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, 0.08, z);
      scene.add(p);
    }
  let dusk = lots.length && [...built].length >= lots.length && arrived === null ? 1 : 0;
  function updateDusk(dt: number, target: number): void {
    dusk += (target - dusk) * (1 - Math.exp(-0.5 * dt));
    const k = dusk;
    (scene.background as THREE.Color).copy(DAY.sky).lerp(DUSK.sky, k);
    scene.fog?.color.copy(DAY.sky).lerp(DUSK.sky, k);
    sun.color.copy(DAY.sun).lerp(DUSK.sun, k);
    sun.intensity = 1.7 - 0.45 * k;
    hemi.color.copy(DAY.hemi).lerp(DUSK.hemi, k);
    hemi.groundColor.copy(DAY.ground).lerp(DUSK.ground, k);
    hemi.intensity = 1.35 - 0.3 * k;
    glowMat.opacity = Math.min(1, Math.max(0, (k - 0.3) / 0.4));
    poolMat.opacity = 0.18 * glowMat.opacity;
  }

  // What's in the truck's bed: nothing, or a pallet of panels and a crate.
  const BED = [new THREE.Vector3(-0.7, 0.52, 0), new THREE.Vector3(-0.26, 0.52, 0.08)];
  let loaded = false;
  const load: THREE.Mesh[] = [M.cargo().mesh(Cell, [2.5, 0, 3]), M.crate().mesh(Cell, [1.5, 0, 1.5])];
  /** Things flying in an arc, from the pile into the bed or from the bed onto a lot. */
  const flying: { mesh: THREE.Mesh; from: THREE.Vector3; to: () => THREE.Vector3; t: number; delay: number; land: () => void }[] = [];
  function fly(mesh: THREE.Mesh, from: THREE.Vector3, to: () => THREE.Vector3, delay: number, land: () => void): void {
    mesh.removeFromParent();
    scene.add(mesh);
    mesh.position.copy(from);
    mesh.rotation.set(0, 0, 0);
    flying.push({ mesh, from, to, t: 0, delay, land });
  }
  function updateFlying(dt: number): void {
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      f.t = Math.min(1, f.t + dt / 0.55);
      const to = f.to();
      f.mesh.position.lerpVectors(f.from, to, f.t).setY(f.from.y + (to.y - f.from.y) * f.t + Math.sin(Math.PI * f.t) * 1.4);
      f.mesh.rotation.y = truck.heading * f.t;
      if (f.t >= 1) {
        flying.splice(i, 1);
        f.land();
      }
    }
  }
  const bedWorld = (k: number) => () => {
    truck.root.updateMatrixWorld(true);
    return truck.tilt.localToWorld(BED[k].clone());
  };

  // ------------------------------------------------------------------ arriving with a new building

  let party = -1;
  const allBuilt = () => lots.every((l) => l.built);
  /** The new building, waiting to pop in once the fade has cleared. */
  let arrivingHouse: THREE.Group | null = null;
  if (arrivedLot) {
    arrivingHouse = builtLot(arrivedLot);
    arrivingHouse.scale.setScalar(0.001);
    for (const p of arrivedLot.people) p.mesh.visible = false;
    party = 0;
  }
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  /** Seconds into the forklift loading the truck, or -1. */
  let forkT = -1;
  let forkFrom: THREE.Vector3[] = [];
  function updateFork(dt: number): void {
    if (forkT < 0) return;
    forkT += dt;
    const t = forkT;
    const bed0 = bedWorld(0)();
    const stand = new THREE.Vector3(bed0.x - 1.15, 0, bed0.z);
    // On the forks: where each thing sits, in the world.
    const onForks = (k: number) => {
      fork.updateMatrixWorld(true);
      return forks.localToWorld(new THREE.Vector3(0.45 + k * 0.05, 0.08 + k * 0.32, (k - 0.5) * 0.1));
    };
    const e = (a: number, b: number) => ease(Math.min(1, Math.max(0, (t - a) / (b - a))));
    // Out to the truck (0.35-0.8 s) and back (1.05-1.45 s); the forks rise on the way.
    fork.position.lerpVectors(FORK_HOME, stand, e(0.35, 0.8) * (1 - e(1.05, 1.45)));
    forks.position.y = 0.12 + 0.42 * e(0.35, 0.8) * (1 - e(1.05, 1.45));
    load.forEach((m, k) => {
      if (t < 0.35) {
        // A little hop from the pile onto the forks.
        const a = e(0, 0.35);
        m.position.lerpVectors(forkFrom[k], onForks(k), a).setY(m.position.y + Math.sin(Math.PI * a) * 0.4);
      } else if (t < 0.8) m.position.copy(onForks(k));
      else if (t < 1.05) m.position.lerpVectors(onForks(k), bedWorld(k)(), e(0.8, 1.05));
      else if (m.parent === scene) {
        truck.tilt.add(m);
        m.position.copy(BED[k]);
        m.rotation.set(0, 0, 0);
        pops.add(m);
        Audio.thud();
      }
    });
    if (t >= 1.05 && !loaded) {
      loaded = true;
      Audio.sectionDone(2);
    }
    if (t >= 1.45) forkT = -1;
  }

  /** Seconds until we go to the building site, once the truck's unloaded; -1 while not going. */
  let buildIn = -1;

  function progress(): void {
    Hud.steps(lots.map((l) => ({ icon: Hud.Icons.house(B.recolour(l.bp, looksOf(l.i)).colour, l.built), state: l.built ? "done" : "todo" })), true);
  }
  progress();
  // All built here: the gate to the next neighbourhood's the way on (or, at the very last, the new-town button).
  Hud.nudge(allBuilt() && nextHood === null);
  let gateOpening = allBuilt() && arrivedLot !== null && nextHood !== null ? 0 : -1;
  if (gateOpening >= 0) {
    gates[0].open = false;
    gates[0].lift = 0;
  }

  const focus = new THREE.Vector3(truck.pos.x, 0, truck.pos.y - 2.5);
  if (arrivedLot) focus.set(arrivedLot.x, 0, arrivedLot.front - 1.5);
  let clock = 0;
  let leaving = false;
  let buildLot = 0;
  let debugCam: { pos: THREE.Vector3; at: THREE.Vector3 } | null = null;

  function tick(dt: number, input: Input.Frame): void {
    clock += dt;
    // The fade back in takes about 0.4 s: the new building pops up once it's clear.
    if (arrivingHouse && clock > 0.45) {
      arrivingHouse.scale.setScalar(1);
      pops.add(arrivingHouse, true);
      arrivingHouse = null;
    }
    if (buildIn >= 0) {
      buildIn -= dt;
      if (buildIn < 0) hooks.build(buildLot);
    }
    truck.drive(input, dt, world);
    truck.settle(ground, dt);
    truck.update(dt, world);

    // The party for a new building: it pops up, its people come out, confetti, and a fanfare when
    // that was the last lot.
    if (party >= 0 && arrivedLot) {
      party += dt;
      const was = party - dt;
      if (was < 0.15 && party >= 0.15) {
        Audio.sectionDone(3);
        fx.dustRect(arrivedLot.x, 0.05, arrivedLot.front - arrivedLot.bp.d / 2, arrivedLot.bp.w + 0.4, arrivedLot.bp.d + 0.4, 2);
        fx.ring(new THREE.Vector3(arrivedLot.x, 0.05, arrivedLot.front - arrivedLot.bp.d / 2), 5, 0xffe3a0);
      }
      if (was < 0.9 && party >= 0.9)
        for (const p of arrivedLot.people) {
          p.mesh.visible = true;
          pops.add(p.mesh, true);
          Audio.pop();
        }
      if (party < 3 && Math.floor(party * 3) !== Math.floor(was * 3))
        fx.confetti(new THREE.Vector3(arrivedLot.x + (Math.random() - 0.5) * 3, 3.4, arrivedLot.front - 2 + (Math.random() - 0.5) * 2), 36);
      if (allBuilt() && was < 1.4 && party >= 1.4) Audio.fanfare();
      if (allBuilt() && party > 1.4 && party < 8 && Math.floor(party * 2) !== Math.floor(was * 2)) {
        const l = lots[Math.floor(Math.random() * lots.length)];
        fx.confetti(new THREE.Vector3(l.x, 3.6, l.front - 2), 30);
      }
    }

    // The street's finished: after the party, the gate to the next neighbourhood swings up.
    if (gateOpening >= 0) {
      gateOpening += dt;
      if (gateOpening > 3.2 && !gates[0].open) {
        gates[0].open = true;
        Audio.fanfare();
        fx.confetti(new THREE.Vector3(GATE_X, 3, ROAD_A), 60);
        fx.ring(new THREE.Vector3(GATE_X - 1.5, 0.05, ROAD_A), 3, 0xffe3a0);
      }
    }
    for (const g of gates) updateGate(g, dt, clock);
    // Through an open gate: off to that neighbourhood.
    if (!leaving && flying.length === 0)
      for (const g of gates)
        if (g.open && truck.pos.x > GATE_X - 1.2 && Math.abs(truck.pos.y - g.z) < HALF) {
          leaving = true;
          Audio.whoosh();
          hooks.travel(g.to);
        }

    const stopped = (x: number, z: number) => Math.hypot(truck.pos.x - x, truck.pos.y - z) < 1.1 && truck.speed < 1.5;
    const busy = flying.length > 0 || leaving || forkT >= 0;
    const anyLeft = lots.some((l) => !l.built);
    // Empty: load up at the yard. Loaded: take it to a lot.
    const atPile = !loaded && !busy && anyLeft && stopped(LOAD_AT.x, LOAD_AT.y);
    let at: Lot | null = null;
    if (loaded && !busy) for (const l of lots) if (!l.built && stopped(l.x, l.roadZ)) at = l;

    // The nearest lot still to build gets the arrow (or the pile does, while the truck's empty).
    let next: Lot | null = null;
    let nd = Infinity;
    for (const l of lots) {
      if (l.built) continue;
      const d = Math.hypot(truck.pos.x - l.x, truck.pos.y - l.roadZ);
      if (d < nd) [next, nd] = [l, d];
    }
    const from = new THREE.Vector3(truck.pos.x, 0, truck.pos.y);
    const nextGate = gates.find((g) => g.to === nextHood && g.open);
    if (!anyLeft && nextGate && !busy) marker.update(dt, new THREE.Vector3(GATE_X, 3.1, nextGate.z), new THREE.Vector3(GATE_X - 1.5, 0, nextGate.z), 1.2, from);
    else if (busy || !anyLeft || at || atPile) marker.update(dt, null, null, 1, null);
    else if (!loaded) marker.update(dt, PILE.clone().setY(1.3), null, 1, from);
    else if (next) {
      const top = new THREE.Vector3(next.x, 0.52 + (B.roofAt(next.bp).y + next.bp.roof.height) * 0.3 + 0.2, next.fence - 1.1);
      marker.update(dt, top, null, 1, from);
    }
    hooks.hints(!!(at || atPile), false);
    workPrompt.show(at || atPile ? workGlyph(hooks.controls()) : null, new THREE.Vector3(truck.pos.x, truck.y + 1.75, truck.pos.y), dt);

    if (atPile && input.workPressed) {
      // The forklift brings it over: picks up the pallet and crate, scoots to the truck, lifts
      // them in, and scoots back. Quick, so it's a moment to watch and not a wait.
      forkT = 0;
      forkFrom = load.map((m) => {
        m.removeFromParent();
        scene.add(m);
        return PILE.clone().add(new THREE.Vector3(0, 0.6, 0));
      });
      truck.speed = 0;
      Audio.clank();
    }
    updateFork(dt);
    if (at && input.workPressed) {
      // Out of the bed and onto the lot, then off to build it.
      const lot = at;
      truck.speed = 0;
      leaving = true;
      load.forEach((m, k) => {
        // Beside the lot's little model on its stand, not on it.
        const drop = new THREE.Vector3(lot.x - 2.5 + k * 1.1, 0.02, lot.fence - 1.2);
        fly(m, bedWorld(k)(), () => drop, k * 0.3, () => {
          pops.add(m);
          Audio.thud();
          fx.dust(drop, 0.4, 6);
          if (k === load.length - 1) {
            Audio.whoosh();
            buildIn = 0.35;
            buildLot = lot.i;
          }
        });
      });
    }
    loadRing.visible = !loaded && anyLeft;
    (loadRing.material as THREE.MeshBasicMaterial).color.setHex(atPile ? 0xff8a1f : 0xffffff);
    loadRing.scale.setScalar(1 + 0.06 * Math.sin(clock * 4));

    // The empty lots' little models turn on their stands; the one you're at spins up and grows.
    for (const l of lots) {
      if (!l.mini || !l.ring) continue;
      const here = l === at;
      l.mini.rotation.y += dt * (here ? 2.2 : 0.5);
      const s = l.mini.scale.x + ((here ? 1.25 : 1) - l.mini.scale.x) * (1 - Math.exp(-8 * dt));
      l.mini.scale.setScalar(s);
      const mat = l.ring.material as THREE.MeshBasicMaterial;
      mat.color.setHex(here ? 0xff8a1f : 0xffffff);
      mat.opacity = loaded ? 0.75 : 0.25;
      l.ring.scale.setScalar(1 + 0.06 * Math.sin(clock * 4 + l.i));
    }

    updatePeople(dt, truck.pos);
    updateCars(dt);
    // Evening comes once the street's all built (after the last building's party).
    updateDusk(dt, allBuilt() && (party < 0 || party > 4) ? 1 : 0);
    for (const a of anims) a(clock);
    const duck = scene.getObjectByName("duck");
    if (duck) {
      duck.position.set(3 + Math.cos(clock * 0.3) * 2.2, 0.01, 17.5 + Math.sin(clock * 0.3) * 1.2);
      duck.rotation.y = -clock * 0.3 - Math.PI;
    }

    updateFlying(dt);
    pops.update(dt);
    fx.update(dt);
    Audio.setEngine(truck.speed / truck.def.speed, true);

    const want = new THREE.Vector3(truck.pos.x, 0, truck.pos.y - 2.5);
    want.x = Math.max(-16, Math.min(gates.length ? 20 : 16, want.x));
    want.z = Math.max(-6, Math.min(9.5, want.z));
    const admiring = arrivedLot !== null && party >= 0 && party < 3;
    if (admiring) want.set(arrivedLot!.x, 0, arrivedLot!.front - 1.5);
    focus.lerp(want, 1 - Math.exp(-3.5 * dt));
    frameCamera(focus, party < 0 ? 0 : admiring ? Math.min(1, party / 0.8) : Math.max(0, 1 - (party - 3) / 1.2));
    if (debugCam) {
      camera.position.copy(debugCam.pos);
      camera.lookAt(debugCam.at);
    }
  }

  return {
    scene,
    camera,
    tick,
    dispose() {
      disposeScene(scene, new Set([voxelMaterial]));
    },
    debug: {
      truck, lots, fx, gates, cars, get dusk() { return dusk; }, get loaded() { return loaded; },
      look(x?: number, y = 0, z = 0, ax = 0, ay = 0, az = 0) {
        debugCam = x === undefined ? null : { pos: new THREE.Vector3(x, y, z), at: new THREE.Vector3(ax, ay, az) };
      },
    },
  };
}
