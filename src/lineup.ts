import * as THREE from "three";
import type * as Input from "./input";
import * as M from "./models";
import { Cell } from "./models";
import * as B from "./blueprints";
import { Crane, Dozer, DumpTruck, Excavator, Machine, Mixer, Roller, Sweeper, Truck, type World } from "./machines";
import type { Ground } from "./site";
import { disposeScene, lit, type Mode } from "./stage";
import { voxelMaterial } from "./voxel";

/**
 * A dev-only page (`?lineup`) for reviewing the art: every machine and vehicle side by side on
 * sand, with people and a cottage for scale. Left and right step from one to the next, up and down
 * zoom, Work (Space) starts and stops the turntable, Hop (E) swaps the game's own camera angle for a
 * low close-up. Not in the released game.
 */
export function createLineup(): Mode {
  const { scene, camera, frame } = lit();
  const ground: Ground = { boxes: [], circles: [], heightAt: () => 0 };

  // Sand to stand on, and a line of pale tiles marking each spot.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(120, 30), new THREE.MeshLambertMaterial({ color: M.C.Sand }));
  sand.rotation.x = -Math.PI / 2;
  sand.receiveShadow = true;
  scene.add(sand);

  type Item = { name: string; obj: THREE.Object3D; machine?: Machine; spin: number };
  const items: Item[] = [];
  const SPACING = 4;
  const at = (i: number) => (i - 6) * SPACING;
  const addMachine = (name: string, m: Machine) => {
    const x = at(items.length);
    scene.add(m.root);
    m.place(x, 0, 0, ground);
    if (m instanceof Crane) m.attachTo(scene);
    items.push({ name, obj: m.root, machine: m, spin: 0 });
  };
  const addMesh = (name: string, mesh: THREE.Object3D) => {
    mesh.position.set(at(items.length), 0, 0);
    scene.add(mesh);
    items.push({ name, obj: mesh, spin: 0 });
  };

  addMachine("Excavator", new Excavator(new THREE.Vector2()));
  addMachine("Cement mixer", new Mixer(new THREE.Vector2()));
  addMachine("Dump truck", new DumpTruck(new THREE.Vector2()));
  addMachine("Crane", new Crane(new THREE.Vector2()));
  addMachine("Road roller", new Roller(new THREE.Vector2()));
  addMachine("Bulldozer", new Dozer(new THREE.Vector2()));
  addMachine("Street sweeper", new Sweeper(new THREE.Vector2()));
  addMachine("Crew truck", new Truck(new THREE.Vector2()));
  {
    const g = new THREE.Group();
    g.add(M.forkliftBody().mesh(Cell, [0, 0, 0]));
    const forks = M.forkliftForks().mesh(Cell, [0, 0, 0]);
    forks.position.set(0.6, 0.12, 0);
    g.add(forks);
    addMesh("Forklift", g);
  }
  addMesh("Car", M.car(0xd8382c).mesh(Cell, [0, 0, 0]));
  addMesh("Bus", M.bus().mesh(Cell, [0, 0, 0]));
  addMesh("Tractor", M.tractor().mesh(Cell, [0, 0, 0]));
  {
    // People in a little row, for scale: a mum, a dad, two children, a grandparent, a wheelchair user, a dog.
    const g = new THREE.Group();
    const look = (shirt: number, long = false, dress = false): M.Look => ({ shirt, pants: 0x3c4652, hair: 0x5a3a22, skin: 0xe0ac7e, long, dress });
    const people = [
      M.person({ ...look(0x4aa8ff), beard: 0x5a3a22, fullBeard: true }),
      M.person({ ...look(0xff5d8f, true, true), skin: 0xf1c7a0, hair: 0xc9a15a }),
      M.person({ ...look(0x3fb950), shorts: true, shoes: 0xf0f0f0, shortSleeves: true }, true),
      M.person({ ...look(0xffc93c, true, true), shoes: 0xf0f0f0 }, true),
      M.person({ ...look(0xd8382c), skin: 0x8d5a3b, hair: 0x1a1410, bald: true, jacket: 0x2f3b52 }),
      M.person({ ...look(0x6fd3b0), skin: 0xf6d3a6, hair: 0xb5523b, shortSleeves: true }),
      M.elder({ ...look(0xb9a6e6), hair: 0xe8e8e8, bald: true, beard: 0xe8e8e8 }),
      M.wheelchair({ ...look(0xff8a1f), skin: 0x5e3b28, hair: 0x1a1410, jacket: 0x6b4a2b }),
      M.dog(0xc98a3e, 0xf3e6c8),
    ];
    people.forEach((p, k) => {
      const m = p.mesh(M.WorkerCell, [0, 0, 0.5]);
      m.position.set(0, 0, (k - 4) * 0.42); // side by side, all facing +x
      g.add(m);
    });
    addMesh("People", g);
  }
  addMesh("Cottage", B.assemble(B.HOODS[0].lots[0]));

  // The name of whichever one's in front, in the corner.
  const label = document.createElement("div");
  label.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:6;padding:8px 14px;border-radius:12px;background:rgba(255,255,255,.85);font:600 18px system-ui;color:#3a3f47";
  document.body.appendChild(label);
  const help = document.createElement("div");
  help.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:6;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.7);font:13px system-ui;color:#3a3f47";
  help.textContent = "← → step · ↑ ↓ zoom · Space spin · E camera";
  document.body.appendChild(help);

  let sel = 0;
  let spin = true;
  let close = false;
  let zoom = 1;
  let stick = false;
  const focus = new THREE.Vector3(at(0), 0, 0);
  const world: World = { site: ground, machines: [] };
  let t = 0;

  // For screenshots from the console: lineup.show(index, angle, close, zoom).
  (window as unknown as { lineup: unknown }).lineup = {
    show(i: number, angle = 0.6, c = true, z = 1) {
      sel = i;
      spin = false;
      close = c;
      zoom = z;
      items[i].spin = angle;
      focus.set(items[i].obj.position.x, 0, 0);
    },
  };

  function tick(dt: number, input: Input.Frame): void {
    t += dt;
    if (Math.abs(input.moveX) > 0.5 && !stick) {
      sel = (sel + Math.sign(input.moveX) + items.length) % items.length;
      stick = true;
    }
    if (Math.abs(input.moveX) < 0.3) stick = false;
    zoom = Math.max(0.35, Math.min(2.5, zoom * (1 - input.moveY * dt * 1.2)));
    if (input.workPressed) spin = !spin;
    if (input.hopPressed) close = !close;
    const it = items[sel];
    label.textContent = `${sel + 1}/${items.length}  ${it.name}`;
    if (spin) it.spin += dt * 0.6;
    for (const x of items) {
      if (x.machine) {
        x.machine.heading = x.spin;
        x.machine.settle(ground, dt, true);
        x.machine.update(dt, world);
      } else x.obj.rotation.y = x.spin;
    }
    focus.lerp(new THREE.Vector3(it.obj.position.x, 0, 0), 1 - Math.exp(-6 * dt));
    if (close) {
      // Low and three-quarters on, close in.
      const d = 4.2 * zoom;
      camera.position.set(focus.x + d * 0.7, 1.6 * zoom + 0.4, d * 0.75);
      camera.lookAt(focus.x, 0.55, 0);
    } else {
      // The game's own camera, so it's judged the way it's seen.
      frame(focus);
      if (zoom !== 1) {
        const dir = camera.position.clone().sub(focus);
        camera.position.copy(focus).addScaledVector(dir, zoom);
        camera.lookAt(focus);
      }
    }
    void t;
  }

  return {
    scene,
    camera,
    tick,
    dispose() {
      label.remove();
      help.remove();
      disposeScene(scene, new Set([voxelMaterial]));
    },
  };
}
