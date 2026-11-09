import * as THREE from "three";
import * as M from "./models";
import { C, Cell } from "./models";
import type { Frame } from "./input";
import type { Box, Circle, Ground } from "./site";

/**
 * The machines and how they drive. Driving is Kickstack's (VehicleOps.steer): the stick points
 * where to go on screen; the machine turns toward it at its turn rate and drives nose first,
 * never backing up, and well off the nose it stops and turns on the spot, so its turning circle
 * never orbits what you aimed at. Speeds are gentle: this is a calm game.
 *
 * Heading h: the machine faces (cos h, 0, -sin h), i.e. h = 0 is east and h = pi/2 is up the screen.
 */
export interface Def {
  speed: number;
  accel: number;
  turn: number; // radians per second
  halfLen: number;
  radius: number; // how far it reaches sideways (the widest of its collision circles)
  circles: [number, number][]; // collision circles: offset along the heading, and radius
  cab: THREE.Vector3; // where the worker hops in, in the machine's frame
}

const deg = Math.PI / 180;

export interface World {
  site: Ground;
  machines: Machine[];
}

export abstract class Machine {
  readonly root = new THREE.Group(); // position and heading
  readonly tilt = new THREE.Group(); // pitch over the ground
  readonly pos = new THREE.Vector2();
  y = 0;
  heading = Math.PI / 2;
  speed = 0;
  pitch = 0;
  driven = false;
  private beacon: THREE.Mesh;
  private beaconMat = new THREE.MeshBasicMaterial({ color: 0x7a5a10 });
  private time = 0;

  constructor(readonly name: string, readonly def: Def, beaconAt: THREE.Vector3, readonly home: THREE.Vector2) {
    this.root.add(this.tilt);
    this.beacon = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), this.beaconMat);
    this.beacon.position.copy(beaconAt);
    this.pos.copy(home);
  }

  protected addBeacon(parent: THREE.Object3D): void {
    parent.add(this.beacon);
  }

  get forward(): THREE.Vector2 {
    return new THREE.Vector2(Math.cos(this.heading), -Math.sin(this.heading));
  }

  /** A part of a task is playing out: the wheels stay put. */
  abstract busy(): boolean;

  /** Where the worker sits, in the world. */
  cabWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.tilt.localToWorld(this.def.cab.clone());
  }

  drive(f: Frame, dt: number, w: World): void {
    const mag = Math.min(1, Math.hypot(f.moveX, f.moveY));
    let top = 0;
    if (this.driven && !this.busy() && mag > 0) {
      const want = Math.atan2(f.moveY, f.moveX);
      const off = wrap(want - this.heading);
      const step = this.def.turn * dt;
      this.heading = wrap(this.heading + Math.max(-step, Math.min(step, off)));
      top = Math.abs(off) > 60 * deg ? 0 : this.def.speed * mag;
    }
    const dv = this.def.accel * dt;
    this.speed = this.speed < top ? Math.min(top, this.speed + dv) : Math.max(top, this.speed - dv * 1.5);
    const before = this.pos.clone();
    this.pos.addScaledVector(this.forward, this.speed * dt);
    this.collide(w);
    // What actually happened: a machine pressed into a wall doesn't keep its speed.
    const moved = this.pos.clone().sub(before).dot(this.forward) / Math.max(dt, 1e-6);
    if (moved < this.speed) this.speed = Math.max(0, moved);
  }

  /** Each collision circle, in the world. */
  circleCentres(): THREE.Vector2[] {
    const f = this.forward;
    return this.def.circles.map(([o]) => this.pos.clone().addScaledVector(f, o));
  }

  /** Each collision circle in the world, with its radius. */
  shape(): Circle[] {
    const f = this.forward;
    return this.def.circles.map(([o, r]) => ({ x: this.pos.x + f.x * o, z: this.pos.y + f.y * o, r }));
  }

  /** Pushes out of everything it overlaps: fence, props, walls, mounds and the other machines. */
  collide(w: World): void {
    const boxes: Box[] = w.site.boxes;
    const circles: Circle[] = [...w.site.circles];
    for (const m of w.machines) if (m !== this) circles.push(...m.shape());
    for (let iter = 0; iter < 3; iter++) {
      for (const own of this.shape()) {
        const c = new THREE.Vector2(own.x, own.z);
        const r = own.r;
        const push = new THREE.Vector2();
        for (const b of boxes) {
          const px = Math.max(b.minX, Math.min(c.x, b.maxX));
          const pz = Math.max(b.minZ, Math.min(c.y, b.maxZ));
          const dx = c.x - px, dz = c.y - pz;
          const d = Math.hypot(dx, dz);
          if (d >= r) continue;
          if (d > 1e-6) push.add(new THREE.Vector2(dx, dz).multiplyScalar((r - d) / d));
          else {
            // Centre inside the box: out the nearest side.
            const outs = [
              [c.x - b.minX + r, -1, 0], [b.maxX - c.x + r, 1, 0],
              [c.y - b.minZ + r, 0, -1], [b.maxZ - c.y + r, 0, 1],
            ].sort((a, b2) => a[0] - b2[0])[0];
            push.add(new THREE.Vector2(outs[1] * outs[0], outs[2] * outs[0]));
          }
        }
        for (const o of circles) {
          const dx = c.x - o.x, dz = c.y - o.z;
          const d = Math.hypot(dx, dz);
          const min = r + o.r;
          if (d >= min || d < 1e-6) continue;
          push.add(new THREE.Vector2(dx, dz).multiplyScalar((min - d) / d));
        }
        this.pos.add(push);
      }
    }
  }

  /** Sits on the ground: height from under its front and back, tipping between them. */
  settle(site: Ground, dt: number, snap = false): void {
    const f = this.forward;
    const k = this.def.halfLen * 0.75;
    const hf = site.heightAt(this.pos.x + f.x * k, this.pos.y + f.y * k);
    const hb = site.heightAt(this.pos.x - f.x * k, this.pos.y - f.y * k);
    const hm = site.heightAt(this.pos.x, this.pos.y);
    const ty = Math.max((hf + hb) / 2, Math.min(hm, Math.max(hf, hb)) - 0.05);
    const tp = Math.atan2(hf - hb, 2 * k);
    const a = snap ? 1 : 1 - Math.exp(-12 * dt);
    this.y += (ty - this.y) * a;
    this.pitch += (tp - this.pitch) * a;
    this.root.position.set(this.pos.x, this.y, this.pos.y);
    this.root.rotation.y = this.heading;
    this.tilt.rotation.z = this.pitch;
  }

  update(dt: number, _w: World): void {
    this.time += dt;
    const on = this.driven && Math.sin(this.time * 9) > 0;
    this.beaconMat.color.setHex(this.driven ? (on ? 0xffb020 : 0xff7a00) : 0x6b5520);
    this.beacon.rotation.y = this.time * 4;
  }

  /** Puts it straight down somewhere (a restart, or moving it out of the building's way). */
  place(x: number, z: number, heading: number, site: Ground): void {
    this.pos.set(x, z);
    this.heading = heading;
    this.speed = 0;
    this.settle(site, 0, true);
  }
}

export function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => a + wrap(b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** A timed list of poses, played one after another; each step calls `done` as it finishes. */
interface Step<P> {
  to: (from: P) => P;
  dur: number;
  done?: () => void;
}
class Sequence<P> {
  private i = 0;
  private t = 0;
  private from: P;
  private goal: P;
  constructor(start: P, private steps: Step<P>[], private mix: (a: P, b: P, t: number) => P) {
    this.from = start;
    this.goal = steps[0].to(start);
  }
  get finished(): boolean {
    return this.i >= this.steps.length;
  }
  /** Advances and returns the pose now. */
  tick(dt: number): P {
    if (this.finished) return this.goal;
    this.t += dt;
    const s = this.steps[this.i];
    const k = Math.min(1, this.t / s.dur);
    const pose = this.mix(this.from, this.goal, ease(k));
    if (k >= 1) {
      s.done?.();
      this.i++;
      this.t = 0;
      this.from = this.goal;
      if (!this.finished) this.goal = this.steps[this.i].to(this.from);
    }
    return pose;
  }
}

// ======================================================================== excavator

interface ArmPose {
  yaw: number; // house, relative to the tracks
  boom: number;
  stick: number;
  bucket: number;
  dirt: boolean;
}
const mixArm = (a: ArmPose, b: ArmPose, t: number): ArmPose => ({
  yaw: lerpAngle(a.yaw, b.yaw, t),
  boom: lerp(a.boom, b.boom, t),
  stick: lerp(a.stick, b.stick, t),
  bucket: lerp(a.bucket, b.bucket, t),
  dirt: t < 1 ? a.dirt : b.dirt,
});

export interface DigEvents {
  bite(q: number): void; // the bucket's in the ground
  dump(q: number): void; // the bucket tips out over the mound
}

export class Excavator extends Machine {
  private house = new THREE.Group();
  private boom = new THREE.Group();
  private stick = new THREE.Group();
  private bucket = new THREE.Group();
  private dirt: THREE.Mesh;
  pose: ArmPose = { yaw: 0, boom: 38 * deg, stick: -112 * deg, bucket: -30 * deg, dirt: false };
  private seq: Sequence<ArmPose> | null = null;
  private again: (() => void) | null = null;

  static readonly REST = { boom: 38 * deg, stick: -112 * deg, bucket: -30 * deg };
  /** Held out over a dump truck's bed to load it: further out and higher than over a heap. */
  static LOAD = { boom: 40 * deg, stick: -55 * deg, tip: -40 * deg };

  constructor(home: THREE.Vector2) {
    super(
      "excavator",
      { speed: 2.6, accel: 5, turn: 120 * deg, halfLen: 0.9, radius: 0.62, circles: [[-0.35, 0.62], [0.35, 0.62], [1.45, 0.35]], cab: new THREE.Vector3(0.25, 1.15, -0.4) },
      new THREE.Vector3(0.25, 1.17, -0.4),
      home,
    );
    this.tilt.add(M.excavatorTracks().mesh(Cell));
    this.house.position.set(0, 0.3, 0);
    this.house.add(M.excavatorHouse().mesh(Cell));
    this.tilt.add(this.house);
    this.addBeacon(this.house);

    this.boom.position.set(0.6, 0.35, 0.05);
    this.boom.add(M.excavatorBoom().mesh(Cell, [0.5, 0.5, 0.5]));
    this.house.add(this.boom);
    this.stick.position.set(1.5, 0, 0);
    this.stick.add(M.excavatorStick().mesh(Cell, [0, 0.5, 0.5]));
    this.boom.add(this.stick);
    this.bucket.position.set(1.15, 0, 0);
    this.bucket.add(M.excavatorBucket().mesh(Cell, [0.5, 0.5, 0.5]));
    this.dirt = M.bucketDirt().mesh(Cell, [0.5, 0.5, 0.5]);
    this.dirt.visible = false;
    this.bucket.add(this.dirt);
    this.stick.add(this.bucket);
    this.applyPose();
  }

  busy(): boolean {
    return this.seq !== null;
  }

  private applyPose(): void {
    this.house.rotation.y = this.pose.yaw;
    this.boom.rotation.z = this.pose.boom;
    this.stick.rotation.z = this.pose.stick;
    this.bucket.rotation.z = this.pose.bucket;
    this.dirt.visible = this.pose.dirt;
  }

  /** The house's yaw (relative to the tracks) that points the arm at a world point. */
  private yawTo(x: number, z: number): number {
    const a = Math.atan2(-(z - this.pos.y), x - this.pos.x);
    return wrap(a - this.heading);
  }

  /** The bucket's teeth, in the world. */
  bucketWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.bucket.localToWorld(new THREE.Vector3(-0.3, -0.45, 0));
  }

  /**
   * One scoop: reach into the quadrant, curl the bucket full, lift, swing round over the mound,
   * tip it out, and swing back. `next` is asked at the end whether to go again (the button's held).
   */
  dig(q: number, at: THREE.Vector2, mound: THREE.Vector2, ev: DigEvents, next: () => boolean, high = false): void {
    if (this.seq) return;
    const toPit = this.yawTo(at.x, at.y);
    const toMound = this.yawTo(mound.x, mound.y);
    const steps: Step<ArmPose>[] = [
      // Brisk: about 2.4 s a scoop, so holding the button is digging, not waiting.
      { dur: 0.35, to: (p) => ({ ...p, yaw: toPit, boom: 6 * deg, stick: -38 * deg, bucket: 45 * deg }) },
      { dur: 0.32, to: (p) => ({ ...p, boom: -8 * deg, stick: -62 * deg, bucket: 10 * deg }), done: () => ev.bite(q) },
      { dur: 0.25, to: (p) => ({ ...p, boom: 0 * deg, stick: -100 * deg, bucket: -75 * deg, dirt: true }) },
      { dur: 0.28, to: (p) => ({ ...p, boom: 40 * deg, stick: -95 * deg, bucket: -80 * deg }) },
      // Over the heap, or held up high over a dump truck's bed.
      { dur: 0.45, to: (p) => ({ ...p, yaw: toMound, boom: high ? Excavator.LOAD.boom : 30 * deg, stick: high ? Excavator.LOAD.stick : -70 * deg }) },
      { dur: 0.22, to: (p) => ({ ...p, bucket: 50 * deg, stick: high ? Excavator.LOAD.tip : -50 * deg }), done: () => ev.dump(q) },
      { dur: 0.1, to: (p) => ({ ...p, dirt: false }) },
      { dur: 0.42, to: (p) => ({ ...p, yaw: toPit, ...Excavator.REST }) },
    ];
    this.seq = new Sequence(this.pose, steps, mixArm);
    this.again = () => {
      if (!next()) this.seq = new Sequence(this.pose, [{ dur: 0.5, to: (p) => ({ ...p, yaw: 0 }) }], mixArm);
    };
  }

  update(dt: number, w: World): void {
    super.update(dt, w);
    if (this.seq) {
      this.pose = this.seq.tick(dt);
      if (this.seq.finished) {
        this.seq = null;
        const a = this.again;
        this.again = null;
        a?.();
      }
    }
    this.applyPose();
  }
}

// ======================================================================== cement mixer

export class Mixer extends Machine {
  private drum = new THREE.Group();
  private spin = 0;
  pouring = false;

  constructor(home: THREE.Vector2) {
    super(
      "mixer",
      { speed: 3.2, accel: 6, turn: 140 * deg, halfLen: 1.25, radius: 0.7, circles: [[-0.65, 0.7], [0.55, 0.7]], cab: new THREE.Vector3(0.85, 1.2, 0) },
      new THREE.Vector3(0.85, 1.36, 0.3),
      home,
    );
    this.tilt.add(M.mixerBody().mesh(Cell));
    const mount = new THREE.Group();
    mount.position.set(-0.4, 1.12, 0);
    mount.rotation.z = -12 * deg; // the mouth end (-x) up
    this.drum.add(M.mixerDrum().mesh(Cell, [0, 0, 0]));
    mount.add(this.drum);
    this.tilt.add(mount);
    const chute = M.mixerChute().mesh(Cell, [0, 0, 0]);
    chute.position.set(-1.2, 1.0, 0);
    chute.rotation.z = 30 * deg; // its far end (-x) down
    this.tilt.add(chute);
    this.addBeacon(this.tilt);
  }

  busy(): boolean {
    return false;
  }

  /** The chute's lip, where concrete drops from, in the world. */
  chuteWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.tilt.localToWorld(new THREE.Vector3(-1.75, 0.68, 0));
  }

  update(dt: number, w: World): void {
    super.update(dt, w);
    const rate = this.pouring ? 7 : this.driven ? 2 : 0.6;
    this.spin += rate * dt;
    this.drum.rotation.x = this.spin;
  }
}

// ======================================================================== crane

interface CranePose {
  yaw: number; // the top, relative to the carrier
  pitch: number; // boom
  ext: number; // how far the boom's telescoped out, all sections together
  cable: number; // tip to hook
  hold: number; // 0..1: how far the load's turned from how it lay to how it goes
}
const mixCrane = (a: CranePose, b: CranePose, t: number): CranePose => ({
  yaw: lerpAngle(a.yaw, b.yaw, t),
  pitch: lerp(a.pitch, b.pitch, t),
  ext: lerp(a.ext, b.ext, t),
  cable: lerp(a.cable, b.cable, t),
  hold: lerp(a.hold, b.hold, t),
});

/** Something the crane can lift: a wall panel or the roof. */
export interface Load {
  mesh: THREE.Object3D;
  hang: number; // hook to the load's pivot, straight down
  slings: number; // half the spread of the two slings at the load's top
  top: number; // the load's pivot to where the slings meet it
  rest: THREE.Quaternion; // how it lies before it's lifted
  carryYaw: number; // turned this much from the boom, while carried
  /**
   * A big flat load (a roof, a floor): half its size along the boom while carried, and how tall it
   * is at that edge (a gable's eaves are low even though its ridge is high).
   */
  reach?: number;
  edge?: number;
}

const BOOM_ROOT = new THREE.Vector3(-0.3, 0.62, 0.2); // on the top
const SECTION = M.BOOM_SECTION * Cell;
const NEST = 0.1; // how far each section sits out of the one before, retracted
const FLY_TIP = SECTION - 0.05; // along the inner section, to the sheave
const BASE_TIP = 2 * NEST + FLY_TIP; // root to tip, retracted
// Each of the two inner sections slides out half of the extension, keeping 0.35 of itself in its sleeve.
const MAX_EXT = 2 * (SECTION - NEST - 0.35);

export class Crane extends Machine {
  private top = new THREE.Group();
  private boom = new THREE.Group();
  private mid = new THREE.Group();
  private fly = new THREE.Group();
  private hook: THREE.Mesh;
  private cable: THREE.Mesh;
  private slingA: THREE.Mesh;
  private slingB: THREE.Mesh;
  pose: CranePose = { yaw: 0, pitch: -7 * deg, ext: 0, cable: 0.25, hold: 0 };
  private seq: Sequence<CranePose> | null = null;
  load: Load | null = null;
  private loadFrom: THREE.Quaternion | null = null;
  private loadTo: THREE.Quaternion | null = null; // set while setting a load down
  private loadAt: THREE.Vector3 | null = null; // where it's being set down
  private turnT = 0; // how far it's turned to fit, over the swing

  // At rest the boom lies on its rest over the carrier's front.
  static readonly REST: CranePose = { yaw: 0, pitch: -7 * deg, ext: 0, cable: 0.25, hold: 0 };
  // Carried high and close in, so even the roof clears the carrier's cab under it.
  static readonly CARRY: CranePose = { yaw: 0, pitch: 64 * deg, ext: 1.2, cable: 0.35, hold: 1 };

  constructor(home: THREE.Vector2) {
    super(
      "crane",
      { speed: 2.8, accel: 5, turn: 115 * deg, halfLen: 1.35, radius: 0.55, circles: [[-0.8, 0.55], [0, 0.55], [0.8, 0.55]], cab: new THREE.Vector3(1.1, 0.95, -0.2) },
      new THREE.Vector3(0.05, 0.86, -0.25),
      home,
    );
    this.tilt.add(M.craneCarrier().mesh(Cell));
    this.top.position.set(-0.4, 0.5, 0);
    this.top.add(M.craneTop().mesh(Cell));
    this.tilt.add(this.top);
    this.addBeacon(this.top);
    this.boom.position.copy(BOOM_ROOT);
    this.boom.add(M.craneBoomBase().mesh(Cell));
    this.mid.add(M.craneBoomMid().mesh(Cell, [0, 0.5, 0.5]));
    this.fly.add(M.craneBoomFly().mesh(Cell));
    this.mid.add(this.fly);
    this.boom.add(this.mid);
    this.top.add(this.boom);

    this.hook = M.craneHook().mesh(Cell, [0.5, 0, 0.5]);
    const cableMat = new THREE.MeshLambertMaterial({ color: C.Dark });
    const unit = new THREE.BoxGeometry(1, 1, 1);
    this.cable = new THREE.Mesh(unit, cableMat);
    this.slingA = new THREE.Mesh(unit, cableMat);
    this.slingB = new THREE.Mesh(unit, cableMat);
    for (const m of [this.cable, this.slingA, this.slingB]) m.castShadow = true;
    this.slingA.visible = this.slingB.visible = false;
  }

  /** The hook and cables live in the world, so they hang straight down whatever the boom does. */
  attachTo(scene: THREE.Object3D): void {
    scene.add(this.hook, this.cable, this.slingA, this.slingB);
  }

  busy(): boolean {
    return this.seq !== null;
  }

  private applyPose(): void {
    this.top.rotation.y = this.pose.yaw;
    this.boom.rotation.z = this.pose.pitch;
    const each = Math.max(0, Math.min(MAX_EXT, this.pose.ext)) / 2;
    this.mid.position.x = NEST + each;
    this.fly.position.x = NEST + each;
  }

  tipWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.fly.localToWorld(new THREE.Vector3(FLY_TIP, -0.15, 0));
  }

  /**
   * The top's yaw, boom pitch and extension that put the boom tip over a world point, with the
   * tip at least `minTipY` high if it can (it goes steeper and longer for a tall building).
   */
  aimAt(target: THREE.Vector3, minTipY = -Infinity): { yaw: number; pitch: number; ext: number; tipY: number } {
    this.root.updateMatrixWorld(true);
    const local = this.tilt.worldToLocal(target.clone()).sub(this.top.position);
    const R = Math.max(0.3, Math.hypot(local.x, local.z));
    const beta = Math.atan2(-local.z, local.x); // three's yaw: +x toward -z
    // Yaw so the target lies on the boom's line (the boom's off to the side by BOOM_ROOT.z).
    const yaw = wrap(beta + Math.asin(Math.max(-1, Math.min(1, BOOM_ROOT.z / R))));
    const along = Math.sqrt(Math.max(0, R * R - BOOM_ROOT.z * BOOM_ROOT.z)) - BOOM_ROOT.x;
    const rootY = this.y + this.top.position.y + BOOM_ROOT.y;
    let best = { yaw, pitch: 0, ext: 0, tipY: -Infinity };
    for (let p = 55; p <= 80; p += 2.5) {
      let pitch = p * deg;
      let len = along / Math.cos(pitch);
      if (len < BASE_TIP) {
        len = BASE_TIP;
        pitch = Math.acos(Math.min(1, along / len));
      } else if (len > BASE_TIP + MAX_EXT) {
        len = BASE_TIP + MAX_EXT;
        pitch = Math.acos(Math.min(1, along / len));
      }
      const tipY = rootY + len * Math.sin(pitch) - 0.15;
      if (tipY > best.tipY) best = { yaw, pitch, ext: len - BASE_TIP, tipY };
      if (tipY >= minTipY) return { yaw, pitch, ext: len - BASE_TIP, tipY };
    }
    return best;
  }

  /**
   * Can the boom get its tip high enough over `place` to carry a load hanging `hang` below the
   * hook down onto it from above (a third storey, a tall pile)? If not, it needs to come closer.
   */
  canReachOver(place: THREE.Vector3, hang: number): boolean {
    const hookY = place.y + hang;
    return this.aimAt(place, hookY + 0.9).tipY >= hookY + 0.3;
  }

  /** How far a world point is from the turntable, along the ground. */
  reach(p: THREE.Vector3): number {
    const c = new THREE.Vector3();
    this.top.getWorldPosition(c);
    return Math.hypot(p.x - c.x, p.z - c.z);
  }

  /** Swing over a load, lower the hook, hitch it, lift it and fold up to carry it. */
  pick(load: Load, done: () => void, hitched: () => void): void {
    if (this.seq) return;
    const at = load.mesh.position.clone();
    const hookY = at.y + load.hang;
    const aim = this.aimAt(at, hookY + 0.3);
    this.seq = new Sequence(this.pose, [
      { dur: 0.45, to: (p) => ({ ...p, yaw: aim.yaw, pitch: aim.pitch, ext: aim.ext, cable: 0.5 }) },
      { dur: 0.32, to: (p) => ({ ...p, cable: Math.max(0.3, aim.tipY - hookY) }), done: () => {
        this.load = load;
        this.loadFrom = load.mesh.quaternion.clone();
        hitched();
      } },
      { dur: 0.32, to: (p) => ({ ...p, cable: 0.6, hold: 1 }) },
      { dur: 0.42, to: () => this.carryPose(load), done },
    ], mixCrane);
  }

  /**
   * How to carry it while driving. A wall panel is thin, so it's carried high and close. A roof or
   * a floor is big and flat, so it's carried out behind on a long boom with a long cable: clear of
   * the carrier, clear under the boom, and trailing away from wherever the crane's driving to.
   */
  carryPose(load: Load): CranePose {
    const R = load.reach ?? 0;
    if (R < 0.5) return { ...Crane.CARRY };
    const E = load.edge ?? 0;
    const rootY = this.y + this.top.position.y + BOOM_ROOT.y;
    for (const deg_ of [60, 55, 50, 45, 40, 35, 30]) {
      const p = deg_ * deg;
      // Its near edge past the carrier's back (0.65 behind the boom's foot) with room to spare.
      const len = Math.max(BASE_TIP, (R + 0.95) / Math.cos(p));
      if (len > BASE_TIP + MAX_EXT) continue;
      // The boom over its near edge stays above that edge (it's higher still over the middle, where
      // the cable comes down past anything tall like a ridge or a cone).
      const cable = Math.max(0.4, R * Math.tan(p) - (load.hang - E) + 0.25);
      const bottom = rootY + len * Math.sin(p) - 0.15 - cable - load.hang;
      if (bottom < 0.4) continue;
      return { yaw: Math.PI, pitch: p, ext: len - BASE_TIP, cable, hold: 1 };
    }
    return { ...Crane.CARRY };
  }

  /** Swing the load over its place, turn it to fit, lower it in, let go and fold back down. */
  setDown(place: THREE.Vector3, facing: THREE.Quaternion, landed: () => void, done: () => void): void {
    if (this.seq || !this.load) return;
    const load = this.load;
    const hookY = place.y + load.hang;
    const aim = this.aimAt(place, hookY + 0.9);
    const start = this.load.mesh.quaternion.clone();
    this.seq = new Sequence(this.pose, [
      { dur: 0.55, to: (p) => ({ ...p, yaw: aim.yaw, pitch: aim.pitch, ext: aim.ext, cable: Math.max(0.3, aim.tipY - hookY - 0.6) }), done: () => {
        this.loadAt = place.clone();
      } },
      { dur: 0.38, to: (p) => ({ ...p, cable: Math.max(0.3, aim.tipY - hookY) }), done: () => {
        this.load = null;
        this.loadAt = null;
        this.loadTo = null;
        landed();
      } },
      { dur: 0.22, to: (p) => ({ ...p, cable: 0.4 }) },
      { dur: 0.4, to: () => ({ ...Crane.REST }), done },
    ], mixCrane);
    this.loadFrom = start;
    this.loadTo = facing.clone();
    this.turnT = 0;
  }

  update(dt: number, w: World): void {
    super.update(dt, w);
    if (this.seq) {
      this.pose = this.seq.tick(dt);
      if (this.seq.finished) this.seq = null;
    }
    this.applyPose();
    this.root.position.set(this.pos.x, this.y, this.pos.y);
    this.root.rotation.y = this.heading;
    this.tilt.rotation.z = this.pitch;
    const tip = this.tipWorld();
    const hook = tip.clone().setY(tip.y - this.pose.cable);
    this.hook.position.copy(hook);
    this.hook.rotation.y = this.heading + this.pose.yaw;
    stretch(this.cable, tip, hook.clone().setY(hook.y + 0.02), 0.035);

    const L = this.load;
    this.slingA.visible = this.slingB.visible = L !== null;
    if (L) {
      const pivot = hook.clone().setY(hook.y - L.hang);
      if (this.loadAt) {
        // Being set down: it slides in over its place while it's lowered.
        pivot.x = this.loadAt.x;
        pivot.z = this.loadAt.z;
      }
      L.mesh.position.copy(pivot);
      const carry = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading + this.pose.yaw + L.carryYaw);
      const from = this.loadFrom ?? L.rest;
      if (this.loadTo) {
        // Turning to fit as it swings over.
        this.turnT = Math.min(1, this.turnT + dt / 0.55);
        L.mesh.quaternion.copy(from).slerp(this.loadTo, ease(this.turnT));
      } else L.mesh.quaternion.copy(from).slerp(carry, Math.min(1, this.pose.hold));
      // Slings from the hook to two points on the load's top.
      const along = new THREE.Vector3(1, 0, 0).applyQuaternion(L.mesh.quaternion);
      const topMid = pivot.clone().add(new THREE.Vector3(0, L.top, 0).applyQuaternion(L.mesh.quaternion));
      const a = topMid.clone().addScaledVector(along, L.slings);
      const b = topMid.clone().addScaledVector(along, -L.slings);
      const hookLow = hook.clone().setY(hook.y - 0.55);
      stretch(this.slingA, hookLow, a, 0.03);
      stretch(this.slingB, hookLow, b, 0.03);
    }
  }

  /** Back to resting, empty (a restart). */
  reset(): void {
    this.seq = null;
    this.load = null;
    this.loadAt = null;
    this.loadTo = null;
    this.pose = { ...Crane.REST };
  }
}

// ======================================================================== road roller

/** Paves the path to the front door: wherever its big drum rolls, the path's done. */
export class Roller extends Machine {
  private drum = new THREE.Group();
  private roll = 0;
  static readonly DRUM_X = 0.7;
  static readonly DRUM_HALF = 0.5; // half its width

  constructor(home: THREE.Vector2) {
    super(
      "roller",
      { speed: 2.6, accel: 5, turn: 130 * deg, halfLen: 1.0, radius: 0.6, circles: [[-0.5, 0.6], [0.55, 0.6]], cab: new THREE.Vector3(-0.25, 0.75, 0) },
      new THREE.Vector3(-0.15, 1.36, 0),
      home,
    );
    this.tilt.add(M.rollerBody().mesh(Cell));
    this.drum.position.set(Roller.DRUM_X, 0.36, 0);
    this.drum.add(M.rollerDrum().mesh(Cell));
    this.tilt.add(this.drum);
    this.addBeacon(this.tilt);
  }

  busy(): boolean {
    return false;
  }

  /** Under the middle of the drum, in the world. */
  drumWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.tilt.localToWorld(new THREE.Vector3(Roller.DRUM_X, 0, 0));
  }

  update(dt: number, w: World): void {
    super.update(dt, w);
    this.roll -= (this.speed * dt) / 0.36;
    this.drum.rotation.z = this.roll;
  }
}

// ======================================================================== bulldozer

/** Clears up at the end: drive the blade into a dirt mound and push it away. */
export class Dozer extends Machine {
  static readonly BLADE_X = 1.15;

  constructor(home: THREE.Vector2) {
    super(
      "dozer",
      { speed: 2.4, accel: 5, turn: 120 * deg, halfLen: 1.0, radius: 0.62, circles: [[-0.35, 0.6], [0.55, 0.62]], cab: new THREE.Vector3(-0.3, 1.0, 0) },
      new THREE.Vector3(-0.3, 1.36, 0),
      home,
    );
    this.tilt.add(M.dozer().mesh(Cell));
    this.addBeacon(this.tilt);
  }

  busy(): boolean {
    return false;
  }

  /** The middle of the blade's cutting edge, in the world. */
  bladeWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.tilt.localToWorld(new THREE.Vector3(Dozer.BLADE_X, 0, 0));
  }
}


// ======================================================================== dump truck

/**
 * Takes the dirt away at the end: stop by a heap and it's loaded in (two heaps fill it), then
 * stop by the skip at the gate and the bed tips up and pours it in.
 */
export class DumpTruck extends Machine {
  static readonly CAPACITY = 2;
  private bed = new THREE.Group();
  private dirt: THREE.Mesh;
  load = 0; // heaps aboard
  private shown = 0; // how full the bed looks, easing toward `load`
  private tipT = -1; // seconds into a tip, or -1
  private tipped: (() => void) | null = null;
  private turnTo: number | null = null; // turning on the spot to back up to the skip, first

  constructor(home: THREE.Vector2) {
    super(
      "dump",
      { speed: 3.0, accel: 6, turn: 130 * deg, halfLen: 1.25, radius: 0.7, circles: [[-0.65, 0.7], [0.55, 0.7]], cab: new THREE.Vector3(0.85, 1.2, 0) },
      new THREE.Vector3(1.12, 1.36, 0.36),
      home,
    );
    this.tilt.add(M.dumpTruckBody().mesh(Cell));
    this.bed.position.set(-1.3, 0.5, 0);
    this.bed.add(M.dumpBed().mesh(Cell, [0, 0, 0]));
    this.dirt = M.bedDirt().mesh(Cell, [0, 0, 0]);
    this.dirt.position.set(0.85, 0.1, 0);
    this.dirt.visible = false;
    this.bed.add(this.dirt);
    this.tilt.add(this.bed);
    this.addBeacon(this.tilt);
  }

  busy(): boolean {
    return this.tipT >= 0 || this.turnTo !== null;
  }

  get full(): boolean {
    return this.load >= DumpTruck.CAPACITY;
  }

  /** Behind the tailgate, where the dirt pours out, in the world. */
  tailWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.tilt.localToWorld(new THREE.Vector3(-1.5, 0.5, 0));
  }

  /** The middle of the bed, in the world (where loaded dirt lands). */
  bedWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.tilt.localToWorld(new THREE.Vector3(-0.4, 0.9, 0));
  }

  /**
   * Turn on the spot so the back faces `into` (the skip), then tip the bed up, pour the load out,
   * and bring the bed down again.
   */
  tip(into: THREE.Vector2, done: () => void): void {
    if (this.busy() || this.load === 0) return;
    this.turnTo = Math.atan2(-(this.pos.y - into.y), this.pos.x - into.x);
    this.tipped = done;
  }

  update(dt: number, w: World): void {
    super.update(dt, w);
    if (this.turnTo !== null) {
      const off = wrap(this.turnTo - this.heading);
      const step = this.def.turn * dt;
      this.heading = wrap(this.heading + Math.max(-step, Math.min(step, off)));
      if (Math.abs(off) <= step) {
        this.turnTo = null;
        this.tipT = 0;
      }
    }
    let angle = 0;
    if (this.tipT >= 0) {
      this.tipT += dt;
      const t = this.tipT;
      // Up (0.6 s), hold while it pours (0.7 s), down (0.5 s).
      angle = t < 0.6 ? ease(t / 0.6) : t < 1.3 ? 1 : t < 1.8 ? 1 - ease((t - 1.3) / 0.5) : 0;
      if (t >= 0.9 && this.load > 0) {
        this.load = 0;
        const f = this.tipped;
        this.tipped = null;
        f?.();
      }
      if (t >= 1.8) this.tipT = -1;
    }
    this.bed.rotation.z = angle * 50 * deg;
    this.shown += (this.load - this.shown) * (1 - Math.exp(-6 * dt));
    const k = this.shown / DumpTruck.CAPACITY;
    this.dirt.visible = k > 0.03;
    this.dirt.scale.set(0.6 + 0.4 * k, Math.max(0.05, k), 0.8 + 0.2 * k);
    this.dirt.position.x = 0.8 - angle * 0.4;
  }
}

// ======================================================================== street sweeper

/** Sweeps up sand blown in from the beach: wherever its brushes go, it's clean. */
export class Sweeper extends Machine {
  private brushes: THREE.Mesh[] = [];
  static readonly BRUSH_X = 0.85;
  static readonly REACH = 0.75; // half the width it sweeps

  constructor(home: THREE.Vector2) {
    super(
      "sweeper",
      { speed: 2.5, accel: 6, turn: 140 * deg, halfLen: 0.9, radius: 0.55, circles: [[-0.3, 0.55], [0.5, 0.55]], cab: new THREE.Vector3(0.3, 1.0, 0) },
      new THREE.Vector3(0.3, 1.16, 0),
      home,
    );
    this.tilt.add(M.sweeperBody().mesh(Cell));
    for (const z of [-0.55, 0.55]) {
      const b = M.sweeperBrush().mesh(Cell, [0, 0, 0]);
      b.position.set(Sweeper.BRUSH_X, 0.02, z);
      this.tilt.add(b);
      this.brushes.push(b);
    }
    this.addBeacon(this.tilt);
  }

  busy(): boolean {
    return false;
  }

  /** The front middle, between the brushes, in the world. */
  brushWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.tilt.localToWorld(new THREE.Vector3(Sweeper.BRUSH_X, 0, 0));
  }

  update(dt: number, w: World): void {
    super.update(dt, w);
    const spin = (this.driven ? 4 : 0) + this.speed * 6;
    this.brushes[0].rotation.y += spin * dt;
    this.brushes[1].rotation.y -= spin * dt;
  }
}

// ======================================================================== the crew's truck

/** For getting about town between building sites. */
export class Truck extends Machine {
  constructor(home: THREE.Vector2) {
    super(
      "truck",
      { speed: 4.4, accel: 8, turn: 160 * deg, halfLen: 1.05, radius: 0.5, circles: [[-0.5, 0.5], [0.5, 0.5]], cab: new THREE.Vector3(0.25, 0.9, 0) },
      new THREE.Vector3(0.2, 1.06, 0),
      home,
    );
    this.tilt.add(M.truck().mesh(Cell));
    this.addBeacon(this.tilt);
  }

  busy(): boolean {
    return false;
  }
}

/** Lays a unit box between two points as a cable `thick` across. */
export function stretch(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, thick: number): void {
  const d = b.clone().sub(a);
  const len = d.length();
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(thick, Math.max(0.001, len), thick);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}
