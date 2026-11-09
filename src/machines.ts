import * as THREE from "three";
import * as M from "./models";
import { C, Cell } from "./models";
import type { Frame } from "./input";
import type { Box, Circle, Site } from "./site";

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
  site: Site;
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
  settle(site: Site, dt: number, snap = false): void {
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
  place(x: number, z: number, heading: number, site: Site): void {
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
  dig(q: number, at: THREE.Vector2, mound: THREE.Vector2, ev: DigEvents, next: () => boolean): void {
    if (this.seq) return;
    const toPit = this.yawTo(at.x, at.y);
    const toMound = this.yawTo(mound.x, mound.y);
    const steps: Step<ArmPose>[] = [
      { dur: 0.5, to: (p) => ({ ...p, yaw: toPit, boom: 6 * deg, stick: -38 * deg, bucket: 45 * deg }) },
      { dur: 0.45, to: (p) => ({ ...p, boom: -8 * deg, stick: -62 * deg, bucket: 10 * deg }), done: () => ev.bite(q) },
      { dur: 0.35, to: (p) => ({ ...p, boom: 0 * deg, stick: -100 * deg, bucket: -75 * deg, dirt: true }) },
      { dur: 0.4, to: (p) => ({ ...p, boom: 40 * deg, stick: -95 * deg, bucket: -80 * deg }) },
      { dur: 0.65, to: (p) => ({ ...p, yaw: toMound, boom: 30 * deg, stick: -70 * deg }) },
      { dur: 0.3, to: (p) => ({ ...p, bucket: 50 * deg, stick: -50 * deg }), done: () => ev.dump(q) },
      { dur: 0.15, to: (p) => ({ ...p, dirt: false }) },
      { dur: 0.6, to: (p) => ({ ...p, yaw: toPit, ...Excavator.REST }) },
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
      { speed: 3.2, accel: 6, turn: 140 * deg, halfLen: 1.25, radius: 0.55, circles: [[-0.75, 0.55], [0, 0.55], [0.75, 0.55]], cab: new THREE.Vector3(0.7, 1.0, 0) },
      new THREE.Vector3(0.65, 1.0, 0),
      home,
    );
    this.tilt.add(M.mixerBody().mesh(Cell));
    const mount = new THREE.Group();
    mount.position.set(-0.3, 0.9, 0);
    mount.rotation.z = -12 * deg; // the mouth end (-x) up
    this.drum.add(M.mixerDrum().mesh(Cell, [0, 0, 0]));
    mount.add(this.drum);
    this.tilt.add(mount);
    this.addBeacon(this.tilt);
  }

  busy(): boolean {
    return false;
  }

  /** The chute's lip, where concrete drops from, in the world. */
  chuteWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.tilt.localToWorld(new THREE.Vector3(-1.5, 0.62, 0.05));
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
  ext: number; // how far the inner section's slid out
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
}

const BOOM_ROOT = new THREE.Vector3(-0.3, 0.55, 0.2); // on the top
const BASE_TIP = 1.75; // root to tip, retracted
const MAX_EXT = 3.4;

export class Crane extends Machine {
  private top = new THREE.Group();
  private boom = new THREE.Group();
  private fly = new THREE.Group();
  private hook: THREE.Mesh;
  private cable: THREE.Mesh;
  private slingA: THREE.Mesh;
  private slingB: THREE.Mesh;
  pose: CranePose = { yaw: 0, pitch: -5 * deg, ext: 0, cable: 0.25, hold: 0 };
  private seq: Sequence<CranePose> | null = null;
  load: Load | null = null;
  private loadFrom: THREE.Quaternion | null = null;
  private loadTo: THREE.Quaternion | null = null; // set while setting a load down
  private loadAt: THREE.Vector3 | null = null; // where it's being set down
  private turnT = 0; // how far it's turned to fit, over the swing (1 s)

  static readonly REST: CranePose = { yaw: 0, pitch: -5 * deg, ext: 0, cable: 0.25, hold: 0 };
  static readonly CARRY: CranePose = { yaw: 0, pitch: 52 * deg, ext: 0.5, cable: 0.45, hold: 1 };

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
    this.boom.add(M.craneBoomBase().mesh(Cell, [0, 0.5, 0.5]));
    this.fly.add(M.craneBoomFly().mesh(Cell, [0, 0.5, 1]));
    this.boom.add(this.fly);
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
    this.fly.position.x = 0.1 + this.pose.ext;
  }

  tipWorld(): THREE.Vector3 {
    this.root.updateMatrixWorld(true);
    return this.boom.localToWorld(new THREE.Vector3(0.1 + this.pose.ext + 1.65, -0.1, 0));
  }

  /** The top's yaw, boom pitch and extension that put the boom tip over a world point. */
  aimAt(target: THREE.Vector3): { yaw: number; pitch: number; ext: number; tipY: number } {
    this.root.updateMatrixWorld(true);
    const local = this.tilt.worldToLocal(target.clone()).sub(this.top.position);
    const R = Math.max(0.3, Math.hypot(local.x, local.z));
    const beta = Math.atan2(-local.z, local.x); // three's yaw: +x toward -z
    // Yaw so the target lies on the boom's line (the boom's off to the side by BOOM_ROOT.z).
    const yaw = wrap(beta + Math.asin(Math.max(-1, Math.min(1, BOOM_ROOT.z / R))));
    const along = Math.sqrt(Math.max(0, R * R - BOOM_ROOT.z * BOOM_ROOT.z)) - BOOM_ROOT.x;
    let pitch = 55 * deg;
    let len = along / Math.cos(pitch);
    if (len < BASE_TIP) {
      len = BASE_TIP;
      pitch = Math.acos(Math.min(1, along / BASE_TIP));
    } else if (len > BASE_TIP + MAX_EXT) {
      len = BASE_TIP + MAX_EXT;
      pitch = Math.acos(Math.min(1, along / len));
    }
    const rootY = this.y + this.top.position.y + BOOM_ROOT.y;
    return { yaw: wrap(yaw), pitch, ext: len - BASE_TIP, tipY: rootY + len * Math.sin(pitch) - 0.1 };
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
    const aim = this.aimAt(at);
    const hookY = at.y + load.hang;
    this.seq = new Sequence(this.pose, [
      { dur: 0.9, to: (p) => ({ ...p, yaw: aim.yaw, pitch: aim.pitch, ext: aim.ext, cable: 0.5 }) },
      { dur: 0.6, to: (p) => ({ ...p, cable: Math.max(0.3, aim.tipY - hookY) }), done: () => {
        this.load = load;
        this.loadFrom = load.mesh.quaternion.clone();
        hitched();
      } },
      { dur: 0.7, to: (p) => ({ ...p, cable: 0.6, hold: 1 }) },
      { dur: 0.8, to: () => ({ ...Crane.CARRY }), done },
    ], mixCrane);
  }

  /** Swing the load over its place, turn it to fit, lower it in, let go and fold back down. */
  setDown(place: THREE.Vector3, facing: THREE.Quaternion, landed: () => void, done: () => void): void {
    if (this.seq || !this.load) return;
    const load = this.load;
    const aim = this.aimAt(place);
    const hookY = place.y + load.hang;
    const start = this.load.mesh.quaternion.clone();
    this.seq = new Sequence(this.pose, [
      { dur: 1.0, to: (p) => ({ ...p, yaw: aim.yaw, pitch: aim.pitch, ext: aim.ext, cable: Math.max(0.3, aim.tipY - hookY - 0.6) }), done: () => {
        this.loadAt = place.clone();
      } },
      { dur: 0.7, to: (p) => ({ ...p, cable: Math.max(0.3, aim.tipY - hookY) }), done: () => {
        this.load = null;
        this.loadAt = null;
        this.loadTo = null;
        landed();
      } },
      { dur: 0.45, to: (p) => ({ ...p, cable: 0.4 }) },
      { dur: 0.8, to: () => ({ ...Crane.REST }), done },
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
        this.turnT = Math.min(1, this.turnT + dt);
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

/** Lays a unit box between two points as a cable `thick` across. */
export function stretch(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, thick: number): void {
  const d = b.clone().sub(a);
  const len = d.length();
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(thick, Math.max(0.001, len), thick);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}
