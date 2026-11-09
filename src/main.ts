import * as THREE from "three";
import * as Audio from "./audio";
import * as Input from "./input";
import * as M from "./models";
import { Cell } from "./models";
import { Fx } from "./fx";
import { breathe, ghost, Marker, Prompt, type Glyph } from "./guide";
import { Crane, Excavator, Machine, Mixer, type Load, type World } from "./machines";
import { FOOT, SCOOPS_PER_QUADRANT, Site, SLAB_TOP, WALL_H, type Quadrant } from "./site";

type Stage = "dig" | "pour" | "walls" | "roof" | "done";
const STAGES: Stage[] = ["dig", "pour", "walls", "roof", "done"];

// ------------------------------------------------------------------ scene

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById("app")!.appendChild(renderer.domElement);

const SKY = 0xa9dcff;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 30, 70);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
const sun = new THREE.DirectionalLight(0xfff6e6, 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(new THREE.HemisphereLight(0xdfefff, 0x6a7a40, 1.35), sun, sun.target);

function resize(): void {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  // On a tall phone screen, pull back so the site still fits across.
  camera.fov = w / h < 0.8 ? 62 : 50;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

const site = new Site();
scene.add(site.root);
const fx = new Fx(scene);
const marker = new Marker(scene);
const workPrompt = new Prompt(scene, 1.15);
const hopPrompt = new Prompt(scene, 0.9);

const excavator = new Excavator(new THREE.Vector2(-4.5, 5.6));
const mixer = new Mixer(new THREE.Vector2(0.2, 6.3));
const crane = new Crane(new THREE.Vector2(5, 5.6));
const machines: Machine[] = [excavator, mixer, crane];
for (const m of machines) {
  scene.add(m.root);
  m.place(m.home.x, m.home.y, Math.PI / 2, site);
}
crane.attachTo(scene);
const world: World = { site, machines };

let active: Machine = excavator;
active.driven = true;

// The worker, seen only while hopping from one cab to another.
const workerMesh = M.worker().mesh(M.WorkerCell, [0.5, 0, 0.5]);
workerMesh.visible = false;
scene.add(workerMesh);
let hop: { from: Machine; to: Machine; t: number } | null = null;

// ------------------------------------------------------------------ the building's parts

const building = new THREE.Group();
scene.add(building);

function wallMesh(k: number): THREE.Mesh {
  const s = site.slots[k];
  return M.wallPanel(s.len, s.style).mesh(Cell, [s.len / 2, 7, 1]);
}

/** Lying flat on the trailer: its length along z, its height along x, its face up. */
const FLAT = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)),
);

const wallLoads: Load[] = site.slots.map((s, k) => {
  const mesh = wallMesh(k);
  // The first to go up is on top of the pile.
  const layer = site.slots.length - 1 - k;
  mesh.position.set(site.trailerAt.x, site.deckTop + 0.1 + layer * 0.2, site.trailerAt.z + (s.len === 40 ? 0 : 0.2));
  mesh.quaternion.copy(FLAT);
  scene.add(mesh);
  return { mesh, hang: 1.85, slings: s.len * Cell * 0.36, top: 0.7, rest: FLAT.clone(), carryYaw: Math.PI / 2 };
});

const roofMesh = M.roof().mesh(Cell, [22, 0, 22]);
roofMesh.position.set(site.palletAt.x, site.palletTop, site.palletAt.z);
scene.add(roofMesh);
const roofLoad: Load = { mesh: roofMesh, hang: 1.95, slings: 1.6, top: 0.9, rest: new THREE.Quaternion(), carryYaw: 0 };
const ROOF_AT = new THREE.Vector3(FOOT.cx, SLAB_TOP + WALL_H, FOOT.cz);

const flagMesh = M.flag().mesh(Cell, [0.5, 0, 0.5]);
flagMesh.position.set(FOOT.cx - 0.6, ROOF_AT.y + 0.9, FOOT.cz);
flagMesh.scale.set(1, 0.001, 1);
flagMesh.visible = false;
scene.add(flagMesh);

// Ghosts: the next part, see-through, where it'll go.
const ghostWalls = site.slots.map((s, k) => {
  const g = ghost(wallMesh(k));
  g.position.copy(s.centre);
  g.rotation.y = s.yaw;
  scene.add(g);
  return g;
});
const ghostRoof = ghost(roofMesh);
ghostRoof.position.copy(ROOF_AT);
scene.add(ghostRoof);
const ghostDig = (() => {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  g.rotation.x = -Math.PI / 2;
  scene.add(g);
  return g;
})();

// ------------------------------------------------------------------ progress and moments

let stage: Stage = "dig";
let wallsUp = 0;
let chimeStep = 0;
const pops: { obj: THREE.Object3D; t: number; base: THREE.Vector3 }[] = [];

function popIn(obj: THREE.Object3D): void {
  pops.push({ obj, t: 0, base: obj.scale.clone() });
}

function setStage(s: Stage): void {
  stage = s;
  document.querySelectorAll<HTMLElement>("#progress .step").forEach((el) => {
    const i = STAGES.indexOf(el.dataset.stage as Stage);
    el.classList.toggle("done", i < STAGES.indexOf(s));
    el.classList.toggle("now", i === STAGES.indexOf(s));
  });
  document.body.classList.toggle("finished", s === "done");
}

/** Moves any machine that's in the building's way back to where it started, in a puff. */
function clearFootprint(except: Machine): void {
  for (const m of machines) {
    if (m === except) continue;
    const inside = m.circleCentres().some(
      (c) => c.x > FOOT.minX - 0.7 && c.x < FOOT.maxX + 0.7 && c.y > FOOT.minZ - 0.7 && c.y < FOOT.maxZ + 0.7,
    );
    if (!inside) continue;
    fx.dust(new THREE.Vector3(m.pos.x, m.y, m.pos.y), 1, 18);
    m.place(m.home.x, m.home.y, Math.PI / 2, site);
    fx.dust(new THREE.Vector3(m.pos.x, 0, m.pos.y), 1, 18);
    Audio.pop();
  }
}

function digDone(): void {
  Audio.sectionDone(4);
  fx.dustRect(FOOT.cx, -0.3, FOOT.cz, 4, 4, 2);
  fx.ring(new THREE.Vector3(FOOT.cx, 0, FOOT.cz), 4, 0xffe3a0);
  for (const c of site.strings.children) fx.dust(c.getWorldPosition(new THREE.Vector3()), 0.2, 3, 0xffffff);
  site.strings.visible = false;
  chimeStep = 0;
  setStage("pour");
}

function slabDone(): void {
  site.finishSlab();
  popIn(site.pitGroup);
  Audio.sectionDone(5);
  fx.dustRect(FOOT.cx, SLAB_TOP, FOOT.cz, 4, 4, 2);
  fx.ring(new THREE.Vector3(FOOT.cx, SLAB_TOP, FOOT.cz), 4.5, 0xffffff);
  mixer.pouring = false;
  setStage("walls");
}

function wallLanded(k: number): void {
  const s = site.slots[k];
  const mesh = wallLoads[k].mesh;
  mesh.position.copy(s.centre);
  mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw);
  scene.remove(mesh);
  building.add(mesh);
  popIn(mesh);
  site.boxes.push(s.box);
  ghostWalls[k].visible = false;
  wallsUp++;
  Audio.thud();
  Audio.sectionDone(2 + wallsUp);
  const along = s.yaw === 0;
  fx.dustRect(s.centre.x, SLAB_TOP, s.centre.z, along ? s.len * Cell : 0.3, along ? 0.3 : s.len * Cell, 2.5);
  if (wallsUp === site.slots.length) setStage("roof");
}

function roofLanded(): void {
  roofMesh.position.copy(ROOF_AT);
  scene.remove(roofMesh);
  building.add(roofMesh);
  popIn(roofMesh);
  ghostRoof.visible = false;
  Audio.thud();
  Audio.fanfare();
  fx.dustRect(FOOT.cx, SLAB_TOP, FOOT.cz, 4.4, 4.4, 2);
  fx.ring(new THREE.Vector3(FOOT.cx, SLAB_TOP, FOOT.cz), 6, 0xffe3a0);
  celebrate = 0;
  setStage("done");
}

let celebrate = -1;

// ------------------------------------------------------------------ per-stage: what to do, and doing it

interface Job {
  machine: Machine;
  over: THREE.Vector3 | null; // the arrow points down here
  spot: THREE.Vector3 | null; // the ring
  ring: number;
  canWork: boolean;
  hold?: boolean; // keeps working while the button's held (digging); otherwise one press each
  work: () => void;
}

function nearestQuadrant(): Quadrant | null {
  let best: Quadrant | null = null;
  let bd = Infinity;
  for (const q of site.quadrants) {
    if (q.scoops >= SCOOPS_PER_QUADRANT) continue;
    const d = q.spot.distanceTo(excavator.pos);
    if (d < bd) [best, bd] = [q, d];
  }
  return best;
}

function digJob(): Job {
  const q = nearestQuadrant();
  if (!q) return { machine: excavator, over: null, spot: null, ring: 1, canWork: false, work: () => {} };
  const spot = new THREE.Vector3(q.spot.x, 0, q.spot.y);
  const there = excavator.pos.distanceTo(q.spot) < 1.25;
  ghostDig.visible = true;
  ghostDig.position.set(q.centre.x, site.heightAt(q.centre.x, q.centre.y) + 0.02, q.centre.y);
  return {
    machine: excavator,
    over: there ? null : spot.clone().setY(0.4),
    spot,
    ring: 1.15,
    hold: true,
    canWork: there && !excavator.busy() && excavator.speed < 0.6,
    work: () => {
      const idx = site.quadrants.indexOf(q);
      excavator.speed = 0;
      excavator.dig(idx, q.centre, q.moundAt, {
        bite: (i) => {
          const qq = site.quadrants[i];
          const finished = site.scoop(qq);
          const b = excavator.bucketWorld();
          fx.bits(b, 10, 0x8c6239, 1.2, site.heightAt(b.x, b.z));
          fx.dust(new THREE.Vector3(qq.centre.x, -0.2, qq.centre.y), 0.7, 6, 0xc9a27a);
          Audio.scoop();
          if (finished) Audio.chime(chimeStep++);
        },
        dump: (i) => {
          const qq = site.quadrants[i];
          const at = site.growMound(qq);
          popIn(qq.mound!);
          fx.bits(excavator.bucketWorld(), 14, 0x8c6239, 1, 0.1);
          fx.dust(at, 0.6, 8, 0xc9a27a);
          Audio.dump();
          if (site.pitDug()) digDone();
        },
      }, () => input.work && site.quadrants[idx].scoops < SCOOPS_PER_QUADRANT);
    },
  };
}

let splashCooldown = 0;
function pourJob(dt: number): Job {
  const tip = mixer.chuteWorld();
  const overPit = tip.x > FOOT.minX - 0.25 && tip.x < FOOT.maxX + 0.25 && tip.z > FOOT.minZ - 0.25 && tip.z < FOOT.maxZ + 0.25;
  mixer.pouring = active === mixer && overPit;
  splashCooldown -= dt;
  if (mixer.pouring) {
    const n = site.pour(tip.x, tip.z, 0.62);
    if (Math.random() < 0.7) {
      const v = new THREE.Vector3(-Math.cos(mixer.heading), 0, Math.sin(mixer.heading)).multiplyScalar(0.6);
      fx.drip(tip, v, site.heightAt(tip.x, tip.z));
    }
    if (n > 0 && splashCooldown <= 0) {
      Audio.splash();
      splashCooldown = 0.12;
    }
    const step = Math.floor(site.poured() * 8);
    if (step > chimeStep) {
      chimeStep = step;
      Audio.chime(step);
    }
    if (site.poured() >= 0.9) slabDone();
  }
  // Point at the nearest cell still to fill.
  const left = site.unpoured();
  let best: THREE.Vector2 | null = null;
  let bd = Infinity;
  for (const p of left) {
    const d = Math.hypot(p.x - tip.x, p.y - tip.z);
    if (d < bd) [best, bd] = [p, d];
  }
  const spot = best ? new THREE.Vector3(best.x, site.heightAt(best.x, best.y), best.y) : null;
  return { machine: mixer, over: spot && bd > 1 ? spot.clone().setY(0.3) : null, spot: bd > 1 ? spot : null, ring: 0.7, canWork: false, work: () => {} };
}

const REACH = 4.6;
function outsideFootprint(m: Machine): boolean {
  const p = m.pos;
  return p.x < FOOT.minX - 0.3 || p.x > FOOT.maxX + 0.3 || p.y < FOOT.minZ - 0.3 || p.y > FOOT.maxZ + 0.3;
}

function craneJob(): Job {
  const k = wallsUp;
  const load = stage === "walls" ? wallLoads[k] : roofLoad;
  if (stage === "walls") ghostWalls.forEach((g, i) => (g.visible = i === k));
  else ghostRoof.visible = true;
  if (crane.busy()) return { machine: crane, over: null, spot: null, ring: 1, canWork: false, work: () => {} };
  if (crane.load !== load) {
    // Go and get it.
    const at = load.mesh.position.clone();
    const r = crane.reach(at);
    return {
      machine: crane,
      over: at.clone().setY(at.y + 0.35),
      spot: null,
      ring: 1,
      canWork: r <= REACH && r >= 0.6,
      work: () => {
        crane.speed = 0;
        crane.pick(load, () => {}, () => Audio.clank());
      },
    };
  }
  // Take it to its place.
  const place = stage === "walls" ? site.slots[k].centre.clone() : ROOF_AT.clone();
  const r = crane.reach(place);
  const facing =
    stage === "walls"
      ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), site.slots[k].yaw)
      : (() => {
          // The roof's the same either way round: turn it the shorter way.
          const yaw = crane.heading + crane.pose.yaw;
          const q = Math.round(yaw / Math.PI) * Math.PI;
          return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), q);
        })();
  const ok = r <= REACH && outsideFootprint(crane);
  return {
    machine: crane,
    over: ok ? null : place.clone().setY(stage === "walls" ? 1.7 : 2.6),
    spot: stage === "walls" ? place.clone().setY(SLAB_TOP) : null,
    ring: 0.9,
    canWork: ok,
    work: () => {
      crane.speed = 0;
      clearFootprint(crane);
      if (stage === "walls") crane.setDown(place, facing, () => wallLanded(k), () => {});
      else crane.setDown(place, facing, () => roofLanded(), () => {});
    },
  };
}

// ------------------------------------------------------------------ the loop

let input: Input.Frame = Input.read();
let focus = new THREE.Vector3(active.pos.x, 0, active.pos.y);
let last = performance.now();
let clock = 0;
/** Dev aid: `game.look(x, y, z, atX, atY, atZ)` holds the camera somewhere; `game.look()` lets go. */
let debugCam: { pos: THREE.Vector3; at: THREE.Vector3 } | null = null;
const CAM = new THREE.Vector3(0, 10.5, 8.4); // three-quarter top-down, about 51 degrees, like Kickstack

function machineTop(m: Machine): THREE.Vector3 {
  return new THREE.Vector3(m.pos.x, m.y + (m === crane ? 1.5 : m === excavator ? 1.55 : 1.35), m.pos.y);
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick(dt, Input.read());
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function tick(dt: number, read: Input.Frame): void {
  clock += dt;
  input = read;
  if (input.workPressed || input.hopPressed || input.moveX || input.moveY) Audio.unlock();
  if (input.restartPressed && stage === "done") location.reload();

  // Steer the machine you're in (not while you're mid-hop).
  for (const m of machines) {
    m.drive(hop ? { ...input, moveX: 0, moveY: 0 } : input, dt, world);
    m.settle(site, dt);
    m.update(dt, world);
  }

  ghostDig.visible = false;
  ghostRoof.visible = false;
  ghostWalls.forEach((g) => (g.visible = false));
  const job: Job | null =
    stage === "dig" ? digJob() : stage === "pour" ? pourJob(dt) : stage === "walls" || stage === "roof" ? craneJob() : null;
  if (stage !== "pour") mixer.pouring = false;

  const pad = Input.usingPad();
  const workGlyph: Glyph = pad ? "padA" : "space";
  const hopGlyph: Glyph = pad ? "padY" : "e";

  // Which machine you could hop into: the nearest one close by.
  let near: Machine | null = null;
  if (!hop && !active.busy()) {
    let bd = Infinity;
    for (const m of machines) {
      if (m === active) continue;
      let d = Infinity;
      for (const a of active.circleCentres()) for (const b of m.circleCentres()) d = Math.min(d, a.distanceTo(b));
      d -= active.def.radius + m.def.radius;
      if (d < 0.9 && d < bd) [near, bd] = [m, d];
    }
  }

  if (job && !hop) {
    if (job.machine !== active) {
      // The job needs another machine: point at it.
      // Over it, and higher still if the hop button's showing there too.
      const top = machineTop(job.machine).add(new THREE.Vector3(0, near === job.machine ? 0.75 : 0, 0));
      marker.update(dt, top, null, 1, new THREE.Vector3(active.pos.x, active.y, active.pos.y));
      workPrompt.show(null, null, dt);
    } else {
      marker.update(dt, job.over, job.spot, job.ring, new THREE.Vector3(active.pos.x, active.y, active.pos.y));
      workPrompt.show(job.canWork ? workGlyph : null, machineTop(active).add(new THREE.Vector3(0, 0.75, 0)), dt);
      if (job.canWork && (input.workPressed || (job.hold && input.work))) job.work();
    }
  } else marker.update(dt, null, null, 1, null);
  if (!job) workPrompt.show(null, null, dt);

  hopPrompt.show(near ? hopGlyph : null, near ? machineTop(near).add(new THREE.Vector3(0, 0.7, 0)) : null, dt);
  if (near && input.hopPressed && !hop) {
    hop = { from: active, to: near, t: 0 };
    active.driven = false;
    workerMesh.visible = true;
    Audio.hop();
  }
  if (hop) {
    hop.t += dt / 0.6;
    const a = hop.from.cabWorld(), b = hop.to.cabWorld();
    const k = Math.min(1, hop.t);
    workerMesh.position.lerpVectors(a, b, k).setY(a.y + (b.y - a.y) * k + Math.sin(Math.PI * k) * 1.2 - 0.35);
    workerMesh.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    workerMesh.rotation.z = 0;
    if (k >= 1) {
      active = hop.to;
      active.driven = true;
      workerMesh.visible = false;
      fx.dust(b, 0.3, 5, 0xffffff);
      Audio.pop();
      hop = null;
    }
  }

  // The celebration: confetti for a few seconds, and the flag goes up.
  if (celebrate >= 0) {
    celebrate += dt;
    if (celebrate < 4 && Math.floor(celebrate * 2.5) !== Math.floor((celebrate - dt) * 2.5)) {
      fx.confetti(new THREE.Vector3(FOOT.cx + (Math.random() - 0.5) * 3, 3.2, FOOT.cz + (Math.random() - 0.5) * 3), 40);
    }
    if (celebrate > 0.6) {
      flagMesh.visible = true;
      const k = Math.min(1, (celebrate - 0.6) / 0.6);
      flagMesh.scale.set(1, Math.max(0.001, k < 1 ? k * 1.15 : 1), 1);
    }
  }

  for (const p of pops) {
    p.t += dt / 0.4;
    const k = Math.min(1, p.t);
    const s = 1 + 0.14 * Math.sin(Math.PI * k) * (1 - k * 0.5);
    p.obj.scale.set(p.base.x * s, p.base.y * s, p.base.z * s);
  }
  for (let i = pops.length - 1; i >= 0; i--) if (pops[i].t >= 1) {
    pops[i].obj.scale.copy(pops[i].base);
    pops.splice(i, 1);
  }

  for (const g of [ghostRoof, ...ghostWalls]) breathe(g, clock);
  (ghostDig.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(clock * 4));

  site.update(dt);
  fx.update(dt);
  Audio.setEngine(active.speed / active.def.speed, true);

  // The camera: three-quarter top-down, following whoever you drive (and the worker mid-hop).
  const want = hop ? workerMesh.position.clone().setY(0) : new THREE.Vector3(active.pos.x, 0, active.pos.y);
  // Not so far out that the view's half grass: the site fills it.
  want.x = Math.max(-6.5, Math.min(6.5, want.x));
  want.z = Math.max(-5, Math.min(3.8, want.z));
  if (stage === "done" && celebrate >= 0 && celebrate < 5) want.lerp(new THREE.Vector3(FOOT.cx, 0, FOOT.cz), Math.min(1, celebrate));
  focus.lerp(want, 1 - Math.exp(-4 * dt));
  const zoom = camera.aspect < 0.8 ? 1.25 : 1;
  camera.position.copy(focus).addScaledVector(CAM, zoom);
  camera.lookAt(focus);
  if (debugCam) {
    camera.position.copy(debugCam.pos);
    camera.lookAt(debugCam.at);
  }
  sun.position.set(focus.x - 8, 20, focus.z + 6);
  sun.target.position.copy(focus);

}

// ------------------------------------------------------------------ the page's buttons and dev aids

document.getElementById("restart")!.addEventListener("click", () => location.reload());
document.getElementById("mute")!.addEventListener("click", (e) => {
  Audio.unlock();
  (e.currentTarget as HTMLElement).classList.toggle("off", Audio.toggleMute());
});
addEventListener("pointerdown", () => Audio.unlock());

/** `?stage=pour|walls|roof|done` starts further on, for trying a later task straight away. */
function skipTo(s: Stage): void {
  const at = STAGES.indexOf(s);
  if (at > 0) {
    site.digAll();
    site.strings.visible = false;
  }
  if (at > 1) site.finishSlab();
  if (at > 2 && s !== "walls") {
    for (let k = 0; k < site.slots.length; k++) {
      const st = site.slots[k];
      const mesh = wallLoads[k].mesh;
      mesh.position.copy(st.centre);
      mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.yaw);
      building.add(mesh);
      site.boxes.push(st.box);
      wallsUp++;
    }
  }
  if (at > 3) {
    roofMesh.position.copy(ROOF_AT);
    building.add(roofMesh);
    flagMesh.visible = true;
    flagMesh.scale.set(1, 1, 1);
  }
  const drive: Machine = at === 1 ? mixer : at >= 2 ? crane : excavator;
  active.driven = false;
  active = drive;
  active.driven = true;
  setStage(s);
  focus.set(active.pos.x, 0, active.pos.y);
}
const params = new URLSearchParams(location.search);
const startAt = params.get("stage") as Stage | null;
setStage("dig");
if (startAt && STAGES.includes(startAt)) skipTo(startAt);

// For poking at it from the console (and for checking renders).
Object.assign(window, { game: { site, machines, excavator, mixer, crane, camera, scene, fx, get stage() { return stage; },
  look: (x?: number, y = 0, z = 0, ax = 0, ay = 0, az = 0) => {
    debugCam = x === undefined ? null : { pos: new THREE.Vector3(x, y, z), at: new THREE.Vector3(ax, ay, az) };
  },
  skipTo,
  /** Dev aid: runs the game `seconds` at 60 steps a second with this input held, then draws. */
  advance: (seconds: number, held: Partial<Input.Frame> = {}) => {
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++)
      tick(1 / 60, { moveX: 0, moveY: 0, work: false, workPressed: false, hopPressed: false, restartPressed: false, ...held, ...(i > 0 ? { workPressed: false, hopPressed: false } : {}) });
    renderer.render(scene, camera);
  }, get active() { return active; } } });

requestAnimationFrame(frame);
