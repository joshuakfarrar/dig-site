import * as THREE from "three";
import * as Audio from "./audio";
import * as Hud from "./hud";
import type * as Input from "./input";
import * as M from "./models";
import { Cell } from "./models";
import * as B from "./blueprints";
import { Fx } from "./fx";
import { breathe, ghost, hopGlyph, Marker, Prompt, workGlyph, type Controls } from "./guide";
import { Crane, Dozer, DumpTruck, Excavator, Machine, Mixer, Roller, Sweeper, type Load, type World } from "./machines";
import { PATH, SCOOPS_PER_QUADRANT, Site, SLAB_TOP, type Quadrant } from "./site";
import { disposeScene, lit, Pops, type Mode } from "./stage";
import { voxelMaterial } from "./voxel";

/**
 * One building site: dig the pit, pour the slab, lift in the walls (a storey at a time), lift on
 * the roof, roll the path to the gate, and push the dirt heaps away. Each job's shown at its machine and its spot; nothing's
 * read, nothing's timed, nothing fails.
 */
export type Stage = "dig" | "pour" | "walls" | "roof" | "path" | "clean" | "sweep" | "done";
export const STAGES: Stage[] = ["dig", "pour", "walls", "roof", "path", "clean", "sweep", "done"];

export interface BuildHooks {
  /** It's built and the celebration's had its moment: back to town, with the colours picked for it. */
  finished(looks: B.Looks): void;
  /** Which button pictures to show: keys, pad or touch. */
  controls(): Controls;
  /** Tells the touch buttons what's possible right now. */
  hints(work: boolean, hop: boolean): void;
}

export interface BuildMode extends Mode {
  readonly debug: Record<string, unknown>;
  skipTo(s: Stage): void;
}

export function createBuild(bp: B.Blueprint, hooks: BuildHooks): BuildMode {
  const { scene, camera, frame: frameCamera } = lit();
  const site = new Site(bp);
  scene.add(site.root);
  const F = site.foot;
  const fx = new Fx(scene);
  const marker = new Marker(scene);
  const workPrompt = new Prompt(scene, 1.15);
  const hopPrompt = new Prompt(scene, 0.9);
  const pops = new Pops();

  const excavator = new Excavator(new THREE.Vector2(-5.2, 5.6));
  const mixer = new Mixer(new THREE.Vector2(-2.4, 6.3));
  const roller = new Roller(new THREE.Vector2(2.5, 6.1));
  const crane = new Crane(new THREE.Vector2(5.4, 5.6));
  // The heaps go at the end one of two ways: pushed away by the dozer, or hauled to a skip by the dump truck.
  const haul = bp.finish === "haul";
  const dozer = new Dozer(new THREE.Vector2(8.3, 5.8));
  const dump = new DumpTruck(new THREE.Vector2(8.3, 5.8));
  const finisher: Machine = haul ? dump : dozer;
  const sweeper = bp.sweep ? new Sweeper(new THREE.Vector2(10.6, 5.8)) : null;
  const machines: Machine[] = [excavator, mixer, roller, crane, finisher, ...(sweeper ? [sweeper] : [])];
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

  /** Lying flat on the trailer: its length along z, its height along x, its face up. */
  const FLAT = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)),
  );

  // The pile on the trailer: the first panel to go up is on top. An awning sticks up out of its
  // panel, so that one takes more room in the pile.
  const wallLoads: Load[] = new Array(site.slots.length);
  {
    let y = site.deckTop + 0.1;
    for (let k = site.slots.length - 1; k >= 0; k--) {
      const s = site.slots[k];
      const mesh = B.panelMesh(s);
      mesh.position.set(site.trailerAt.x, y, site.trailerAt.z + (s.side === "back" || s.side === "front" ? 0 : 0.2));
      mesh.quaternion.copy(FLAT);
      scene.add(mesh);
      y += 0.2 + (s.style.awning ? 0.45 : 0) + (s.style.balconies?.length ? 0.32 : 0);
      wallLoads[k] = { mesh, hang: 1.85, slings: s.len * Cell * 0.36, top: 0.7, rest: FLAT.clone(), carryYaw: Math.PI / 2 };
    }
  }

  // The floors between storeys, stacked on their own pallet: the first one to go in on top.
  const floorCount = bp.storeys - 1;
  const floorLoads: Load[] = [];
  for (let s = 1; s <= floorCount; s++) {
    const mesh = B.floorMesh(bp);
    mesh.position.set(site.floorPalletAt.x, site.palletTop + (floorCount - s) * 0.12, site.floorPalletAt.z);
    scene.add(mesh);
    floorLoads.push({
      mesh, hang: 1.0, slings: Math.min(1.6, (bp.w - 0.4) * 0.36), top: 0.05, rest: new THREE.Quaternion(),
      carryYaw: Math.PI / 2, reach: (bp.d - 0.4) / 2, edge: 0.1,
    });
  }
  let floorsUp = 0;
  const ghostFloors = floorLoads.map((_, i) => {
    const g = ghost(B.floorMesh(bp));
    g.position.copy(B.floorAt(bp, i + 1)).add(new THREE.Vector3(F.cx, 0, F.cz));
    scene.add(g);
    return g;
  });
  /** A floor goes in next: this storey's walls are all up and there's another storey to come. */
  const floorNext = () => stage === "walls" && floorsUp < floorCount && wallsUp === (floorsUp + 1) * perStorey;

  let roofMesh = B.roofMesh(bp);
  roofMesh.position.set(site.palletAt.x, site.palletTop, site.palletAt.z);
  scene.add(roofMesh);
  const roofLoad: Load = {
    mesh: roofMesh,
    hang: bp.roof.hang ?? bp.roof.height + 0.75,
    slings: Math.min(1.6, bp.w * 0.36),
    top: bp.roof.slingTop,
    rest: new THREE.Quaternion(),
    // Carried side-on and out behind the crane, clear of it.
    carryYaw: Math.PI / 2,
    reach: bp.d / 2 + 0.2,
    // How tall it is at the edge nearest the crane: low eaves, a flat roof's parapet; the fire
    // station's tower and the play set's slide stand nearer an edge.
    edge: { gable: 0.2, clock: 0.2, tower: 2.0, play: 1.0, lantern: 0.5 }[bp.roof.look as string] ?? 0.45,
  };
  const ROOF_AT = site.roofAt.clone();

  const flagMesh = M.flag().mesh(Cell, [0.5, 0, 0.5]);
  if (bp.roof.look === "gable" || bp.roof.look === "clock") flagMesh.position.set(F.cx - 0.6, ROOF_AT.y + M.gableHeight(bp.d) * Cell, F.cz);
  else flagMesh.position.set(F.minX + 0.4, ROOF_AT.y + 0.2, F.maxZ - 0.4);
  flagMesh.scale.set(1, 0.001, 1);
  flagMesh.visible = false;
  scene.add(flagMesh);

  // Ghosts: the next part, see-through, where it'll go.
  const ghostWalls = site.slots.map((s) => {
    const g = ghost(B.panelMesh(s));
    g.position.copy(s.centre);
    g.rotation.y = s.yaw;
    scene.add(g);
    return g;
  });
  const ghostRoof = ghost(roofMesh);
  ghostRoof.position.copy(ROOF_AT);
  scene.add(ghostRoof);
  const ghostDig = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  ghostDig.rotation.x = -Math.PI / 2;
  scene.add(ghostDig);

  // ------------------------------------------------------------------ progress and moments

  let stage: Stage = "dig";
  let wallsUp = 0;
  let chimeStep = 0;
  let celebrate = -1;
  const perStorey = 4;

  function progress(): void {
    const at = STAGES.indexOf(stage);
    const state = (s: Stage, extra = true): Hud.Step["state"] => {
      const i = STAGES.indexOf(s);
      return i < at || (i === at && !extra) ? "done" : i === at ? "now" : "todo";
    };
    const front = bp.walls[0][3].paint;
    const list: Hud.Step[] = [
      { icon: Hud.Icons.dig, state: state("dig") },
      { icon: Hud.Icons.pour, state: state("pour") },
    ];
    for (let s = 0; s < bp.storeys; s++) {
      const doneHere = wallsUp >= (s + 1) * perStorey;
      const started = wallsUp >= s * perStorey;
      const st: Hud.Step["state"] =
        at > STAGES.indexOf("walls") || doneHere ? "done" : stage === "walls" && started ? "now" : "todo";
      list.push({ icon: s === 0 ? Hud.Icons.walls(front) : Hud.Icons.upstairs(front), state: st });
    }
    const look = bp.roof.look;
    const roofIcon =
      look === "cone" ? Hud.Icons.cone(0xff9ec4)
      : look === "tower" ? Hud.Icons.tower
      : look === "garden" ? Hud.Icons.garden
      : look === "cup" ? Hud.Icons.cup
      : look === "book" ? Hud.Icons.book
      : look === "lights" ? Hud.Icons.lights
      : look === "clock" ? Hud.Icons.clock
      : look === "lantern" ? Hud.Icons.lantern
      : look === "fish" ? Hud.Icons.fish
      : look === "whale" ? Hud.Icons.whale
      : look === "play" ? Hud.Icons.play
      : Hud.Icons.roof(bp.roof.tile ?? 0xd2513a);
    list.push(
      { icon: roofIcon, state: state("roof") },
      { icon: Hud.Icons.path, state: state("path") },
      { icon: haul ? Hud.Icons.haul : Hud.Icons.clean, state: state("clean") },
    );
    if (bp.sweep) list.push({ icon: Hud.Icons.sweep, state: state("sweep") });
    Hud.steps(list);
  }

  function setStage(s: Stage): void {
    stage = s;
    progress();
  }

  /** Moves any machine in the way of what's next back to where it started, in a puff. */
  function clearArea(except: Machine | null, inside: (x: number, z: number) => boolean): void {
    for (const m of machines) {
      if (m === except) continue;
      if (!m.circleCentres().some((c) => inside(c.x, c.y))) continue;
      fx.dust(new THREE.Vector3(m.pos.x, m.y, m.pos.y), 1, 18);
      m.place(m.home.x, m.home.y, Math.PI / 2, site);
      fx.dust(new THREE.Vector3(m.pos.x, 0, m.pos.y), 1, 18);
      Audio.pop();
    }
  }
  const nearFootprint = (x: number, z: number) => x > F.minX - 0.7 && x < F.maxX + 0.7 && z > F.minZ - 0.7 && z < F.maxZ + 0.7;
  const onPath = (x: number, z: number) => x > PATH.minX - 0.7 && x < PATH.maxX + 0.7 && z > F.maxZ - 0.2;

  function digDone(): void {
    site.layBed();
    Audio.sectionDone(4);
    fx.dustRect(F.cx, -0.3, F.cz, bp.w, bp.d, 2);
    fx.ring(new THREE.Vector3(F.cx, 0, F.cz), 4, 0xffe3a0);
    for (const c of site.strings.children) fx.dust(c.getWorldPosition(new THREE.Vector3()), 0.2, 3, 0xffffff);
    site.strings.visible = false;
    chimeStep = 0;
    setStage("pour");
  }

  function slabDone(): void {
    site.finishSlab();
    pops.add(site.pitGroup);
    Audio.sectionDone(5);
    fx.dustRect(F.cx, SLAB_TOP, F.cz, bp.w, bp.d, 2);
    fx.ring(new THREE.Vector3(F.cx, SLAB_TOP, F.cz), 4.5, 0xffffff);
    mixer.pouring = false;
    setStage("walls");
    pickWalls();
  }

  // ------------------------------------------------------------------ picking colours, by picture

  /** What's been picked: [walls, roof], 0 for the building's own colours. */
  const looks: B.Looks = [0, 0];
  let pickWait = 0; // a moment before the pictures take a press, so a held button doesn't pick
  let ticket = -1; // our pictures, if they're up
  let pickStick = false; // the stick's been pushed and not let back yet

  function pickWalls(): void {
    if (!B.canPickWalls(bp)) return;
    ticket = Hud.choose([0, 1, 2, 3].map((c) => B.wallSwatch(bp, c)), (i) => {
      looks[0] = i;
      repaintWalls();
    });
    pickWait = 0.5;
    Audio.pop();
  }

  function pickRoof(): void {
    if (!B.canPickRoof(bp)) return;
    ticket = Hud.choose([0, 1, 2, 3].map((c) => B.roofSwatch(B.recolour(bp, looks), c)), (i) => {
      looks[1] = i;
      repaintRoof();
    });
    pickWait = 0.5;
    Audio.pop();
  }

  /** The panels on the trailer (and their see-through ghosts) in the picked paint. */
  function repaintWalls(): void {
    const styled = B.slots(B.recolour(bp, looks));
    for (let k = wallsUp; k < site.slots.length; k++) {
      site.slots[k].style = styled[k].style;
      const old = wallLoads[k].mesh as THREE.Mesh;
      const mesh = B.panelMesh(site.slots[k]);
      mesh.position.copy(old.position);
      mesh.quaternion.copy(old.quaternion);
      scene.remove(old);
      old.geometry.dispose();
      scene.add(mesh);
      pops.add(mesh);
      wallLoads[k].mesh = mesh;
      ghostWalls[k].geometry = B.panelMesh(site.slots[k]).geometry;
    }
    Audio.sectionDone(3);
    fx.confetti(site.trailerAt.clone().setY(2), 30);
  }

  function repaintRoof(): void {
    const mesh = B.roofMesh(B.recolour(bp, looks));
    mesh.position.copy(roofMesh.position);
    mesh.quaternion.copy(roofMesh.quaternion);
    scene.remove(roofMesh);
    roofMesh.geometry.dispose();
    roofMesh = mesh;
    scene.add(mesh);
    pops.add(mesh);
    roofLoad.mesh = mesh;
    ghostRoof.geometry = B.roofMesh(B.recolour(bp, looks)).geometry;
    Audio.sectionDone(4);
    fx.confetti(site.palletAt.clone().setY(1.5), 30);
  }

  /** While the pictures are up: left/right moves, Work picks; the machines wait. */
  function choosing(dt: number, read: Input.Frame): Input.Frame {
    pickWait -= dt;
    if (Math.abs(read.moveX) > 0.5 && !pickStick) {
      Hud.moveChoice(Math.sign(read.moveX));
      pickStick = true;
      Audio.chime(2);
    }
    if (Math.abs(read.moveX) < 0.3) pickStick = false;
    if (pickWait <= 0 && read.workPressed) Hud.confirmChoice();
    return { ...read, moveX: 0, moveY: 0, work: false, workPressed: false, hopPressed: false };
  }

  function wallLanded(k: number): void {
    const s = site.slots[k];
    const mesh = wallLoads[k].mesh;
    mesh.position.copy(s.centre);
    mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw);
    scene.remove(mesh);
    building.add(mesh);
    pops.add(mesh);
    if (s.box) site.boxes.push(s.box);
    ghostWalls[k].visible = false;
    wallsUp++;
    Audio.thud();
    Audio.sectionDone(2 + (wallsUp % perStorey || perStorey));
    const along = s.yaw === 0;
    fx.dustRect(s.centre.x, s.centre.y - B.WALL_H / 2, s.centre.z, along ? s.len * Cell : 0.3, along ? 0.3 : s.len * Cell, 2.5);
    if (wallsUp === site.slots.length) {
      setStage("roof");
      pickRoof();
    }
    else progress();
  }

  function floorLanded(i: number): void {
    const mesh = floorLoads[i].mesh;
    mesh.position.copy(B.floorAt(bp, i + 1)).add(new THREE.Vector3(F.cx, 0, F.cz));
    mesh.quaternion.identity();
    scene.remove(mesh);
    building.add(mesh);
    pops.add(mesh);
    ghostFloors[i].visible = false;
    floorsUp++;
    Audio.thud();
    Audio.chime(6);
    fx.dustRect(F.cx, mesh.position.y + 0.1, F.cz, bp.w, bp.d, 1.5);
    progress();
  }

  function roofLanded(): void {
    roofMesh.position.copy(ROOF_AT);
    scene.remove(roofMesh);
    building.add(roofMesh);
    pops.add(roofMesh);
    ghostRoof.visible = false;
    Audio.thud();
    Audio.sectionDone(6);
    fx.dustRect(F.cx, ROOF_AT.y, F.cz, bp.w + 0.4, bp.d + 0.4, 2);
    fx.ring(new THREE.Vector3(F.cx, SLAB_TOP, F.cz), 6, 0xffe3a0);
    chimeStep = 0;
    setStage("path");
  }

  // Step-free ramps up to the front doors: they go in with the path.
  const rampGroup = B.ramps(bp);
  rampGroup.add(...B.frontWalk(bp).children);
  rampGroup.position.set(F.cx, 0, F.cz);
  rampGroup.visible = false;
  scene.add(rampGroup);

  function pathDone(): void {
    site.finishPath();
    rampGroup.visible = true;
    for (const r of rampGroup.children) pops.add(r, true);
    Audio.sectionDone(5);
    fx.ring(new THREE.Vector3(0, 0.05, (F.maxZ + 9) / 2), 5, 0xffffff);
    // The heaps stop being in the way if the dozer's going to push them (the dump truck parks by them instead).
    if (!haul) clearHeapCircles();
    chimeStep = 0;
    setStage("clean");
  }

  function clearHeapCircles(): void {
    for (const q of site.quadrants) {
      const i = site.circles.findIndex((c) => c.x === q.moundAt.x && c.z === q.moundAt.y);
      if (i >= 0) site.circles.splice(i, 1);
    }
  }

  /** The heaps are gone: on to sweeping up, if there's sand, or it's finished. */
  function cleanDone(): void {
    Audio.sectionDone(6);
    chimeStep = 0;
    if (bp.sweep) {
      blowSand();
      setStage("sweep");
    } else allDone();
  }

  function allDone(): void {
    Audio.fanfare();
    celebrate = 0;
    setStage("done");
  }

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
  const none = (machine: Machine): Job => ({ machine, over: null, spot: null, ring: 1, canWork: false, work: () => {} });

  let input: Input.Frame;

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
    if (!q) return none(excavator);
    const spot = new THREE.Vector3(q.spot.x, 0, q.spot.y);
    const there = excavator.pos.distanceTo(q.spot) < 1.25;
    ghostDig.visible = true;
    ghostDig.scale.set((q.i1 - q.i0) * 0.5 - 0.1, (q.j1 - q.j0) * 0.5 - 0.1, 1);
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
            pops.add(qq.mound!);
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
    const overPit = tip.x > F.minX - 0.25 && tip.x < F.maxX + 0.25 && tip.z > F.minZ - 0.25 && tip.z < F.maxZ + 0.25;
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
    return guideTo(mixer, site.unpoured(), tip, 1, 0.7);
  }

  /** Points the arrow and ring at the nearest of `left` from `from`, unless it's right there. */
  function guideTo(machine: Machine, left: THREE.Vector2[], from: THREE.Vector3, near: number, ring: number): Job {
    let best: THREE.Vector2 | null = null;
    let bd = Infinity;
    for (const p of left) {
      const d = Math.hypot(p.x - from.x, p.y - from.z);
      if (d < bd) [best, bd] = [p, d];
    }
    const spot = best ? new THREE.Vector3(best.x, site.heightAt(best.x, best.y), best.y) : null;
    return { machine, over: spot && bd > near ? spot.clone().setY(0.3) : null, spot: bd > near ? spot : null, ring, canWork: false, work: () => {} };
  }

  let crunchCooldown = 0;
  function pathJob(dt: number): Job {
    const d = roller.drumWorld();
    crunchCooldown -= dt;
    if (active === roller && roller.speed > 0.2) {
      const fresh = site.pave(d.x, d.z, roller.heading, 0.36, Roller.DRUM_HALF);
      for (const c of fresh) fx.dust(new THREE.Vector3(c.x, 0.05, c.y), 0.2, 2, 0xdedede);
      if (fresh.length && crunchCooldown <= 0) {
        Audio.crunch();
        crunchCooldown = 0.14;
      }
      const step = Math.floor(site.paved() * 8);
      if (step > chimeStep) {
        chimeStep = step;
        Audio.chime(step);
      }
      if (site.paved() >= 0.92) pathDone();
    }
    return guideTo(roller, site.unpaved(), d, 0.9, 0.6);
  }

  /** How much of each dirt heap is left, 1 to 0, while the dozer pushes them away. */
  const heaps = new Map<Quadrant, number>();

  /** Would a heap of radius `r` at (x, z) be into a wall, the fence, a prop or a machine other than the dozer? */
  function heapBlocked(x: number, z: number, r: number): boolean {
    for (const b of site.boxes) {
      const px = Math.max(b.minX, Math.min(x, b.maxX));
      const pz = Math.max(b.minZ, Math.min(z, b.maxZ));
      if (Math.hypot(x - px, z - pz) < r) return true;
    }
    for (const c of site.circles) if (Math.hypot(x - c.x, z - c.z) < r + c.r) return true;
    for (const m of machines) {
      if (m === dozer) continue;
      for (const c of m.shape()) if (Math.hypot(x - c.x, z - c.z) < r + c.r) return true;
    }
    return false;
  }
  function cleanJob(dt: number): Job {
    const blade = dozer.bladeWorld();
    const f = dozer.forward;
    const left: THREE.Vector2[] = [];
    for (const q of site.quadrants) {
      if (!q.mound) continue;
      let amount = heaps.get(q) ?? 1;
      const at = new THREE.Vector2(q.mound.position.x, q.mound.position.z);
      const reach = 0.35 + 0.45 * amount;
      const d = Math.hypot(at.x - blade.x, at.y - blade.z);
      if (active === dozer && dozer.speed > 0.25 && d < reach + 0.2) {
        // Pushed along in front of the blade, getting smaller as it spreads out. Up against a
        // wall, the fence or another machine it stays put and flattens out quicker instead.
        const ahead = new THREE.Vector2(blade.x, blade.z).addScaledVector(f, reach * 1.0);
        const r = (3 + SCOOPS_PER_QUADRANT * 2.2) * Cell * (0.2 + 0.8 * amount) * 0.8;
        const blocked = heapBlocked(ahead.x, ahead.y, r);
        amount = Math.max(0, amount - dt / (blocked ? 0.6 : 1.4));
        if (!blocked) {
          q.mound.position.x = ahead.x;
          q.mound.position.z = ahead.y;
        }
        const at = q.mound.position;
        if (Math.random() < (blocked ? 0.9 : 0.5)) fx.bits(new THREE.Vector3(at.x, 0.15, at.z), 1, 0x8c6239, 0.8, 0);
        if (Math.random() < (blocked ? 0.5 : 0.25)) fx.dust(new THREE.Vector3(at.x, 0.1, at.z), 0.3, 1, 0xc9a27a);
        if (Math.floor(amount * 4) !== Math.floor((heaps.get(q) ?? 1) * 4)) Audio.scoop();
      }
      heaps.set(q, amount);
      q.mound.scale.setScalar(0.2 + 0.8 * amount);
      if (amount <= 0) {
        fx.dust(q.mound.position.clone().setY(0.1), 0.6, 12, 0xc9a27a);
        site.root.remove(q.mound);
        q.mound.geometry.dispose();
        q.mound = null;
        Audio.chime(chimeStep++ + 2);
        continue;
      }
      left.push(new THREE.Vector2(q.mound.position.x, q.mound.position.z));
    }
    if (left.length === 0) {
      cleanDone();
      return none(dozer);
    }
    const job = guideTo(dozer, left, blade, 1.2, 0.9);
    if (job.over) job.over.y = 0.9;
    if (job.spot) job.spot.y = 0;
    return job;
  }

  // ------------------------------------------------------------------ hauling: heaps into the dump truck, then into the skip

  const SKIP_AT = new THREE.Vector3(4.2, 0, 7.9);
  const TIP_AT = new THREE.Vector3(2.1, 0, 7.5); // where the truck stops to tip
  const skipMesh = M.skip().mesh(Cell, [0, 0, 0]);
  const skipDirt = M.bedDirt().mesh(Cell, [0, 0, 0]);
  let skipFill = 0;
  if (haul) {
    skipMesh.position.copy(SKIP_AT);
    scene.add(skipMesh);
    skipDirt.position.set(SKIP_AT.x, 0.1, SKIP_AT.z);
    skipDirt.scale.set(1.1, 0.01, 1.2);
    skipDirt.visible = false;
    scene.add(skipDirt);
    site.circles.push({ x: SKIP_AT.x, z: SKIP_AT.z, r: 1.0 });
  }
  /** A heap being loaded: it sinks away into the truck over half a second. */
  let loading: { q: Quadrant; t: number } | null = null;

  function haulJob(dt: number): Job {
    const heapsLeft = site.quadrants.filter((q) => q.mound && q !== loading?.q);
    if (loading) {
      const L = loading;
      L.t += dt / 0.5;
      const m = L.q.mound!;
      m.scale.setScalar(Math.max(0.05, 1 - L.t));
      if (Math.random() < 0.6) fx.bits(m.position.clone().setY(0.4), 2, 0x8c6239, 1.4, 0);
      if (L.t >= 1) {
        site.root.remove(m);
        m.geometry.dispose();
        L.q.mound = null;
        const i = site.circles.findIndex((c) => c.x === L.q.moundAt.x && c.z === L.q.moundAt.y);
        if (i >= 0) site.circles.splice(i, 1);
        dump.load++;
        Audio.thud();
        Audio.chime(chimeStep++ + 2);
        fx.dust(dump.bedWorld(), 0.5, 8, 0xc9a27a);
        loading = null;
      }
      return none(dump);
    }
    if (heapsLeft.length === 0 && dump.load === 0 && !dump.busy()) {
      cleanDone();
      return none(dump);
    }
    // Full, or nothing left to load: off to the skip.
    if (dump.full || heapsLeft.length === 0) {
      const there = dump.pos.distanceTo(new THREE.Vector2(TIP_AT.x, TIP_AT.z)) < 1.3;
      return {
        machine: dump,
        over: there ? null : SKIP_AT.clone().setY(1.3),
        spot: TIP_AT.clone(),
        ring: 1.1,
        canWork: there && !dump.busy() && dump.speed < 0.8,
        work: () => {
          dump.speed = 0;
          Audio.clank();
          dump.tip(new THREE.Vector2(SKIP_AT.x, SKIP_AT.z), () => {
            const from = dump.tailWorld();
            for (let k = 0; k < 4; k++) fx.bits(from, 8, 0x8c6239, 1.2, 0.3);
            fx.dust(SKIP_AT.clone().setY(0.8), 0.8, 14, 0xc9a27a);
            skipFill = Math.min(1, skipFill + 0.5);
            skipDirt.visible = true;
            skipDirt.scale.y = 0.4 + 1.2 * skipFill;
            pops.add(skipMesh);
            Audio.dump();
          });
        },
      };
    }
    // Room in the bed: the nearest heap gets the ring.
    let best: Quadrant | null = null;
    let bd = Infinity;
    for (const q of heapsLeft) {
      const d = dump.pos.distanceTo(new THREE.Vector2(q.mound!.position.x, q.mound!.position.z));
      if (d < bd) [best, bd] = [q, d];
    }
    const q = best!;
    const at = q.mound!.position.clone().setY(0);
    const there = bd < 2.3;
    return {
      machine: dump,
      over: there ? null : at.clone().setY(1.0),
      spot: at,
      ring: 1.3,
      canWork: there && !dump.busy() && dump.speed < 0.8,
      work: () => {
        dump.speed = 0;
        loading = { q, t: 0 };
        Audio.scoop();
      },
    };
  }

  // ------------------------------------------------------------------ sweeping: sand blown in from the beach

  const sand: { mesh: THREE.Mesh; x: number; z: number; r: number }[] = [];
  function blowSand(): void {
    let seed = 5 + bp.w * 7 + bp.storeys;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 9; k++) {
      const w = 10 + Math.floor(rnd() * 6), d = 8 + Math.floor(rnd() * 5);
      // In open ground: in front of the building, short of where the machines park, and a couple
      // on the path by the gate.
      const byGate = k >= 7;
      const x = byGate ? -0.5 + rnd() : -6.5 + rnd() * 13;
      const z = byGate ? 7.3 + (k - 7) * 0.9 : F.maxZ + 1 + rnd() * (4.3 - F.maxZ - 1);
      const mesh = M.sandPatch(w, d, k).mesh(Cell, [w / 2, 0, d / 2]);
      mesh.position.set(x, 0, z);
      mesh.scale.y = 0.5;
      scene.add(mesh);
      pops.add(mesh, true);
      sand.push({ mesh, x, z, r: Math.max(w, d) * Cell * 0.45 });
      fx.dust(new THREE.Vector3(x, 0.2, z), 0.6, 4, 0xe9cf98);
    }
    Audio.whoosh();
  }

  function sweepJob(): Job {
    if (!sweeper) return none(active);
    const b = sweeper.brushWorld();
    if (active === sweeper && sweeper.speed > 0.2) {
      for (let i = sand.length - 1; i >= 0; i--) {
        const p = sand[i];
        if (Math.hypot(p.x - b.x, p.z - b.z) > p.r + Sweeper.REACH * 0.6) continue;
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        sand.splice(i, 1);
        fx.dust(new THREE.Vector3(p.x, 0.15, p.z), 0.5, 8, 0xe9cf98);
        Audio.crunch();
        Audio.chime(chimeStep++);
      }
    }
    if (sand.length === 0) {
      Audio.sectionDone(6);
      allDone();
      return none(sweeper);
    }
    return guideTo(sweeper, sand.map((p) => new THREE.Vector2(p.x, p.z)), b, 0.9, 0.9);
  }

  const REACH = 4.6;
  function outsideFootprint(m: Machine): boolean {
    const p = m.pos;
    return p.x < F.minX - 0.3 || p.x > F.maxX + 0.3 || p.y < F.minZ - 0.3 || p.y > F.maxZ + 0.3;
  }

  function craneJob(): Job {
    const k = wallsUp;
    const floor = floorNext();
    const fi = floorsUp;
    const walls = stage === "walls" && !floor;
    const load = floor ? floorLoads[fi] : walls ? wallLoads[k] : roofLoad;
    if (floor) ghostFloors[fi].visible = true;
    else if (walls) ghostWalls.forEach((g, i) => (g.visible = i === k));
    else ghostRoof.visible = true;
    if (crane.busy()) return none(crane);
    if (crane.load !== load) {
      // Go and get it.
      const at = load.mesh.position.clone();
      const r = crane.reach(at);
      return {
        machine: crane,
        over: at.clone().setY(at.y + 0.35),
        spot: null,
        ring: 1,
        canWork: r <= REACH && r >= 0.6 && crane.canReachOver(at, load.hang),
        work: () => {
          crane.speed = 0;
          crane.pick(load, () => {}, () => Audio.clank());
        },
      };
    }
    // Take it to its place.
    const place = floor ? B.floorAt(bp, fi + 1).add(new THREE.Vector3(F.cx, 0, F.cz)) : walls ? site.slots[k].centre.clone() : ROOF_AT.clone();
    const r = crane.reach(place);
    const facing = walls
      ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), site.slots[k].yaw)
      : (() => {
          // A roof or a floor's the same either way round: turn it the shorter way.
          const yaw = crane.heading + crane.pose.yaw;
          const q = Math.round(yaw / Math.PI) * Math.PI;
          return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), q);
        })();
    const ok = r <= REACH && outsideFootprint(crane) && crane.canReachOver(place, load.hang);
    return {
      machine: crane,
      over: ok ? null : place.clone().setY(place.y + (walls ? 1 : floor ? 0.6 : bp.roof.height + 0.5)),
      spot: walls ? place.clone().setY(SLAB_TOP) : null,
      ring: 0.9,
      canWork: ok,
      work: () => {
        crane.speed = 0;
        clearArea(crane, nearFootprint);
        if (floor) crane.setDown(place, facing, () => floorLanded(fi), () => {});
        else if (walls) crane.setDown(place, facing, () => wallLanded(k), () => {});
        else crane.setDown(place, facing, () => roofLanded(), () => {});
      },
    };
  }

  // ------------------------------------------------------------------ the loop

  const focus = new THREE.Vector3(active.pos.x, 0, active.pos.y);
  let clock = 0;
  let debugCam: { pos: THREE.Vector3; at: THREE.Vector3 } | null = null;
  let left = false;

  function machineTop(m: Machine): THREE.Vector3 {
    const h = m === crane ? 1.5 : m === excavator ? 1.55 : m === roller || m === dozer || m === dump ? 1.5 : m === sweeper ? 1.4 : 1.35;
    return new THREE.Vector3(m.pos.x, m.y + h, m.pos.y);
  }

  let pathStarted = false;

  function tick(dt: number, read: Input.Frame): void {
    clock += dt;
    input = Hud.choosing() ? choosing(dt, read) : read;

    // Steer the machine you're in (not while you're mid-hop).
    for (const m of machines) {
      m.drive(hop ? { ...input, moveX: 0, moveY: 0 } : input, dt, world);
      m.settle(site, dt);
      m.update(dt, world);
    }

    ghostDig.visible = false;
    ghostRoof.visible = false;
    ghostWalls.forEach((g) => (g.visible = false));
    ghostFloors.forEach((g) => (g.visible = false));
    if (stage === "path" && !pathStarted) {
      pathStarted = true;
      clearArea(roller, onPath);
    }
    const job: Job | null =
      stage === "dig" ? digJob()
      : stage === "pour" ? pourJob(dt)
      : stage === "walls" || stage === "roof" ? craneJob()
      : stage === "path" ? pathJob(dt)
      : stage === "clean" ? (haul ? haulJob(dt) : cleanJob(dt))
      : stage === "sweep" ? sweepJob()
      : null;
    if (stage !== "pour") mixer.pouring = false;

    const controls = hooks.controls();

    // Which machine you could hop into: the nearest one close by.
    let near: Machine | null = null;
    if (!hop && !active.busy() && stage !== "done") {
      let bd = Infinity;
      for (const m of machines) {
        if (m === active) continue;
        let d = Infinity;
        for (const a of active.circleCentres()) for (const b of m.circleCentres()) d = Math.min(d, a.distanceTo(b));
        d -= active.def.radius + m.def.radius;
        if (d < 0.9 && d < bd) [near, bd] = [m, d];
      }
    }

    const from = new THREE.Vector3(active.pos.x, active.y, active.pos.y);
    if (job && !hop) {
      if (job.machine !== active) {
        // The job needs another machine: point at it, higher still if the hop button's showing there too.
        const top = machineTop(job.machine).add(new THREE.Vector3(0, near === job.machine ? 0.75 : 0, 0));
        marker.update(dt, top, null, 1, from);
        workPrompt.show(null, null, dt);
      } else {
        marker.update(dt, job.over, job.spot, job.ring, from);
        workPrompt.show(job.canWork ? workGlyph(controls) : null, machineTop(active).add(new THREE.Vector3(0, 0.75, 0)), dt);
        if (job.canWork && (input.workPressed || (job.hold && input.work))) job.work();
      }
    } else marker.update(dt, null, null, 1, null);
    if (!job) workPrompt.show(null, null, dt);

    // Work glows when it'd do something (and once the celebration's had its moment, to head back).
    hooks.hints((!!job && !hop && job.machine === active && job.canWork) || celebrate > 2, near !== null);
    hopPrompt.show(near ? hopGlyph(controls) : null, near ? machineTop(near).add(new THREE.Vector3(0, 0.7, 0)) : null, dt);
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
      if (k >= 1) {
        active = hop.to;
        active.driven = true;
        workerMesh.visible = false;
        fx.dust(b, 0.3, 5, 0xffffff);
        Audio.pop();
        hop = null;
      }
    }

    // The celebration: confetti for a few seconds, the flag goes up, then back to town.
    if (celebrate >= 0) {
      celebrate += dt;
      if (celebrate < 4 && Math.floor(celebrate * 2.5) !== Math.floor((celebrate - dt) * 2.5)) {
        fx.confetti(new THREE.Vector3(F.cx + (Math.random() - 0.5) * 3, ROOF_AT.y + 1.8, F.cz + (Math.random() - 0.5) * 3), 40);
      }
      if (celebrate > 0.6) {
        flagMesh.visible = true;
        const k = Math.min(1, (celebrate - 0.6) / 0.6);
        flagMesh.scale.set(1, Math.max(0.001, k < 1 ? k * 1.15 : 1), 1);
      }
      if (!left && (celebrate > 6 || (celebrate > 2 && input.workPressed))) {
        left = true;
        hooks.finished([...looks] as B.Looks);
      }
    }

    pops.update(dt);
    for (const g of [ghostRoof, ...ghostWalls, ...ghostFloors]) breathe(g, clock);
    (ghostDig.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(clock * 4));

    site.update(dt);
    fx.update(dt);
    Audio.setEngine(active.speed / active.def.speed, true);

    // The camera: three-quarter top-down, following whoever you drive (and the worker mid-hop).
    const want = hop ? workerMesh.position.clone().setY(0) : new THREE.Vector3(active.pos.x, 0, active.pos.y);
    // Not so far out that the view's half grass: the site fills it.
    want.x = Math.max(-6.5, Math.min(6.5, want.x));
    // Not so far south that the building's up under the progress strip: the machines park low on screen instead.
    want.z = Math.max(-5, Math.min(2.6, want.z));
    if (celebrate >= 0) want.lerp(new THREE.Vector3(F.cx, 0, F.cz), Math.min(1, celebrate));
    focus.lerp(want, 1 - Math.exp(-4 * dt));
    frameCamera(focus, celebrate >= 0 ? Math.min(1, celebrate / 1.5) : 0);
    if (debugCam) {
      camera.position.copy(debugCam.pos);
      camera.lookAt(debugCam.at);
    }
  }

  /** `?stage=pour|walls|roof|path|done` starts further on, for trying a later job straight away. */
  function skipTo(s: Stage): void {
    const at = STAGES.indexOf(s);
    if (at > 0) {
      site.digAll();
      site.strings.visible = false;
    }
    if (at > 1) site.finishSlab();
    if (at > 2) {
      for (let k = 0; k < site.slots.length; k++) {
        const st = site.slots[k];
        const mesh = wallLoads[k].mesh;
        mesh.position.copy(st.centre);
        mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.yaw);
        building.add(mesh);
        if (st.box) site.boxes.push(st.box);
        wallsUp++;
      }
      floorLoads.forEach((l, i) => {
        l.mesh.position.copy(B.floorAt(bp, i + 1)).add(new THREE.Vector3(F.cx, 0, F.cz));
        building.add(l.mesh);
        floorsUp++;
      });
    }
    if (at > 3) {
      roofMesh.position.copy(ROOF_AT);
      building.add(roofMesh);
    }
    if (at > 4) {
      site.finishPath();
      rampGroup.visible = true;
      if (!haul) clearHeapCircles();
    }
    if (at > 5) {
      for (const q of site.quadrants) {
        if (q.mound) site.root.remove(q.mound);
        q.mound = null;
      }
      clearHeapCircles();
      if (s === "sweep") blowSand();
    }
    if (at > 6) {
      flagMesh.visible = true;
      flagMesh.scale.set(1, 1, 1);
    }
    // There's no sweeping without sand: straight on to done.
    if (s === "sweep" && !sweeper) s = "done";
    const drive: Machine = at === 1 ? mixer : at === 4 ? roller : at === 5 ? finisher : at === 6 && sweeper ? sweeper : at >= 2 && at < 5 ? crane : at >= 5 ? finisher : excavator;
    active.driven = false;
    active = drive;
    active.driven = true;
    setStage(s);
    focus.set(active.pos.x, 0, active.pos.y);
    if (s === "walls") pickWalls();
    if (s === "roof") pickRoof();
  }

  setStage("dig");

  return {
    scene,
    camera,
    tick,
    skipTo,
    dispose() {
      Hud.cancelChoice(ticket);
      disposeScene(scene, new Set([voxelMaterial]));
    },
    debug: {
      site, machines, excavator, mixer, roller, crane, dozer, dump, sweeper, fx, sand,
      get stage() { return stage; },
      get active() { return active; },
      look(x?: number, y = 0, z = 0, ax = 0, ay = 0, az = 0) {
        debugCam = x === undefined ? null : { pos: new THREE.Vector3(x, y, z), at: new THREE.Vector3(ax, ay, az) };
      },
    },
  };
}
