import * as THREE from "three";
import * as Audio from "./audio";
import * as Hud from "./hud";
import type * as Input from "./input";
import * as M from "./models";
import { C, Cell } from "./models";
import * as B from "./blueprints";
import { Fx } from "./fx";
import { Marker, Prompt, type Glyph } from "./guide";
import { Crane, Excavator, Mixer, Roller, Truck, type Machine, type World } from "./machines";
import type { Box, Circle, Ground } from "./site";
import { disposeScene, lit, Pops, type Mode } from "./stage";
import { Faces, Model, voxelMaterial } from "./voxel";

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
}

export interface TownHooks {
  build(lot: number): void;
  usingPad(): boolean;
}

export interface TownMode extends Mode {
  readonly debug: Record<string, unknown>;
}

const LOOKS: M.Look[] = [
  { shirt: 0x4aa8ff, pants: 0x3c4652, hair: 0x5a3a22, skin: 0xf6d3a6 },
  { shirt: 0xff5d8f, pants: 0x2f3b52, hair: 0x2b2118, skin: 0xc68a5b },
  { shirt: 0x3fb950, pants: 0x6b4a2b, hair: 0xe0b040, skin: 0xf6d3a6 },
  { shirt: 0xffc93c, pants: 0x3c4652, hair: 0x2b2118, skin: 0x8d5a3b },
  { shirt: 0xc77dff, pants: 0x2f3b52, hair: 0xb5523b, skin: 0xf1c7a0, hat: 0xff5d5d },
  { shirt: 0xff8a1f, pants: 0x3c4652, hair: 0x7a7a7a, skin: 0xe0ac7e },
];

export function createTown(built: Set<number>, arrived: number | null, hooks: TownHooks): TownMode {
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
      { minX: SIDE_X + HALF, maxX: 60, minZ: -60, maxZ: 60 },
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
    for (const z of [ROAD_A, ROAD_B]) f.box(-SIDE_X - HALF, 0, z - HALF, 2 * (SIDE_X + HALF), 0.012, 2 * HALF, Road, top);
    for (const x of [-SIDE_X, SIDE_X]) f.box(x - HALF, 0, ROAD_A + HALF, 2 * HALF, 0.012, ROAD_B - ROAD_A - 2 * HALF, Road, top);
    // Dashes down the middles.
    for (const z of [ROAD_A, ROAD_B])
      for (let x = -SIDE_X + 1; x < SIDE_X - 1; x += 1.4) f.box(x, 0.013, z - 0.06, 0.7, 0, 0.12, Line, top);
    for (const x of [-SIDE_X, SIDE_X])
      for (let z = ROAD_A + HALF + 0.4; z < ROAD_B - HALF - 0.6; z += 1.4) f.box(x - 0.06, 0.013, z, 0.12, 0, 0.7, Line, top);
    // Pavements, a little raised, along both sides of both streets.
    const walk = (x0: number, x1: number, z0: number, z1: number) => f.box(x0, 0, z0, x1 - x0, 0.07, z1 - z0, Walk, (n) => n[1] !== -1, Curb);
    walk(-SIDE_X + HALF, SIDE_X - HALF, ROAD_A - HALF - 1, ROAD_A - HALF);
    walk(-SIDE_X + HALF, SIDE_X - HALF, ROAD_A + HALF, ROAD_A + HALF + 1);
    walk(-SIDE_X + HALF, SIDE_X - HALF, ROAD_B - HALF - 1, ROAD_B - HALF);
    walk(-SIDE_X - HALF, SIDE_X + HALF, ROAD_B + HALF, ROAD_B + HALF + 1);
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

  {
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const trees = [M.tree(0), M.tree(1)];
    const plant = (x: number, z: number) => {
      const t = trees[Math.floor(rnd() * 2)].mesh(Cell);
      t.position.set(x, 0, z);
      t.rotation.y = rnd() * Math.PI;
      t.scale.setScalar(0.9 + rnd() * 0.5);
      scene.add(t);
    };
    for (let k = 0; k < 40; k++) plant(-30 + rnd() * 60, -16 - rnd() * 12); // behind the first street
    for (let k = 0; k < 16; k++) plant(22 + rnd() * 10, -14 + rnd() * 34); // east
    for (let k = 0; k < 10; k++) plant(-30 - rnd() * 6, -14 + rnd() * 34); // west, beyond the yard
    for (let k = 0; k < 14; k++) plant(-30 + rnd() * 60, 24 + rnd() * 8); // beyond the park
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

  // The crew's yard, west of the side road: the machines that do the building, parked.
  const yardMachines: Machine[] = [
    new Excavator(new THREE.Vector2(-23.5, 0.5)),
    new Mixer(new THREE.Vector2(-23.5, 3.2)),
    new Roller(new THREE.Vector2(-23.5, 5.8)),
    new Crane(new THREE.Vector2(-23.5, 8.4)),
  ];
  {
    const f = new Faces();
    f.box(-27, 0, -1.2, 6.5, 0.008, 11.4, C.Sand, (n) => n[1] === 1);
    const yard = new THREE.Mesh(f.geometry(), voxelMaterial);
    yard.receiveShadow = true;
    scene.add(yard);
    const w: World = { site: ground, machines: [] };
    for (const m of yardMachines) {
      scene.add(m.root);
      m.place(m.home.x, m.home.y, 0, ground);
      m.update(0, w);
      if (m instanceof Crane) m.attachTo(scene);
    }
    const cone = M.cone();
    for (const z of [-0.8, 9.9]) {
      const c = cone.mesh(Cell, [0, 0, 0]);
      c.position.set(-20.8, 0, z);
      scene.add(c);
    }
  }

  // The pile of building materials in the yard, and the ring on the road beside it to load up at.
  const PILE = new THREE.Vector3(-21.3, 0, 4.5);
  const LOAD_AT = new THREE.Vector2(-SIDE_X, 4.5);
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
  const loadRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.2, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }),
  );
  loadRing.rotation.x = -Math.PI / 2;
  loadRing.position.set(LOAD_AT.x, 0.03, LOAD_AT.y);
  scene.add(loadRing);

  // ------------------------------------------------------------------ the lots

  const lots: Lot[] = B.LOTS.map((bp, i) => {
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
    const bp = l.bp;
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
    // Flowers along the front wall, either side of the door, and a bush at each corner.
    const hw = bp.w / 2;
    for (const [x0, x1] of [[-hw + 0.1, -1], [1, hw - 0.1]]) {
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

    // Who lives here: a grown-up and a child, sometimes a second grown-up.
    const count = l.i % 3 === 0 ? 3 : 2;
    for (let k = 0; k < count; k++) {
      const look = LOOKS[(l.i * 2 + k) % LOOKS.length];
      const mesh = M.person(look, k === 1).mesh(M.WorkerCell, [0, 0, 0.5]);
      const pos = new THREE.Vector2(l.x - 0.4 + k * 0.4, l.front + 0.35);
      mesh.position.set(pos.x, 0, pos.y);
      scene.add(mesh);
      l.people.push({ mesh, pos, route: [], wait: 0.5 + k * 1.3, speed: k === 1 ? 1.1 : 0.8, phase: k * 2, wave: 0, waveCooldown: 0, lot: l, inside: true });
    }
    return house;
  }

  for (const l of lots) {
    if (built.has(l.i)) builtLot(l);
    else emptyLot(l);
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
          y = Math.abs(Math.sin((1.2 - p.wave) * Math.PI * 2.5)) * 0.18;
        } else if (p.wait > 0) {
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
          y = Math.abs(Math.sin(p.phase * 9)) * 0.05;
        } else p.wait = 1;
        const onWalk = Math.abs(p.pos.y - l.walk) < 0.6;
        p.mesh.position.set(p.pos.x, y + (onWalk ? 0.07 : 0), p.pos.y);
      }
  }

  // ------------------------------------------------------------------ the truck

  const truck = new Truck(new THREE.Vector2(-SIDE_X, 8.6));
  scene.add(truck.root);
  truck.driven = true;
  const world: World = { site: ground, machines: [truck] };
  const arrivedLot = arrived !== null ? lots[arrived] : null;
  if (arrivedLot) truck.place(arrivedLot.x - 2.6, arrivedLot.roadZ, 0, ground);
  else truck.place(truck.home.x, truck.home.y, Math.PI / 2, ground);

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
  /** Seconds until we go to the building site, once the truck's unloaded; -1 while not going. */
  let buildIn = -1;

  function progress(): void {
    Hud.steps(lots.map((l) => ({ icon: Hud.Icons.house(l.bp.colour, l.built), state: l.built ? "done" : "todo" })), true);
  }
  progress();
  Hud.nudge(allBuilt());

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

    const stopped = (x: number, z: number) => Math.hypot(truck.pos.x - x, truck.pos.y - z) < 1.1 && truck.speed < 1.5;
    const busy = flying.length > 0 || leaving;
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
    if (busy || !anyLeft || at || atPile) marker.update(dt, null, null, 1, null);
    else if (!loaded) marker.update(dt, PILE.clone().setY(1.3), null, 1, from);
    else if (next) {
      const top = new THREE.Vector3(next.x, 0.52 + (B.roofAt(next.bp).y + next.bp.roof.height) * 0.3 + 0.2, next.front - 1.2);
      marker.update(dt, top, null, 1, from);
    }
    const glyph: Glyph = hooks.usingPad() ? "padA" : "space";
    workPrompt.show(at || atPile ? glyph : null, new THREE.Vector3(truck.pos.x, truck.y + 1.75, truck.pos.y), dt);

    if (atPile && input.workPressed) {
      // Up from the pile and into the bed, one after the other.
      load.forEach((m, k) =>
        fly(m, PILE.clone().add(new THREE.Vector3(0, 1, 0)), bedWorld(k), k * 0.3, () => {
          truck.tilt.add(m);
          m.position.copy(BED[k]);
          m.rotation.set(0, 0, 0);
          pops.add(m);
          Audio.thud();
          if (k === load.length - 1) {
            loaded = true;
            Audio.sectionDone(2);
          }
        }),
      );
      truck.speed = 0;
      Audio.clank();
    }
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
    want.x = Math.max(-16, Math.min(16, want.x));
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
      truck, lots, fx, get loaded() { return loaded; },
      look(x?: number, y = 0, z = 0, ax = 0, ay = 0, az = 0) {
        debugCam = x === undefined ? null : { pos: new THREE.Vector3(x, y, z), at: new THREE.Vector3(ax, ay, az) };
      },
    },
  };
}
