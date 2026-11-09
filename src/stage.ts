import * as THREE from "three";
import type { Frame } from "./input";
import * as Quality from "./quality";

/**
 * What the town and a building site have in common: a lit, sunny scene and a camera that follows
 * three-quarters from above, like Kickstack. Each is a Mode the main loop runs.
 */
export const SKY = 0xa9dcff;
export const CAM = new THREE.Vector3(0, 10.5, 8.4); // three-quarter top-down, about 51 degrees
const LOW = new THREE.Vector3(0, 4.8, 9.6); // lower and in front, for a finished building

/** How close the camera sits: nearer on a short screen (a phone on its side), so the machines aren't tiny. */
let viewZoom = 1;
export function setViewZoom(z: number): void {
  viewZoom = z;
}

/**
 * Fits a camera to the screen with its middle nudged down by `drop` pixels, so what it follows
 * sits a little below the progress strip along the top rather than under it. The field of view's
 * widened to match, so nothing gets bigger or smaller.
 */
export function fitCamera(camera: THREE.PerspectiveCamera, w: number, h: number, fov: number, drop: number): void {
  const full = h + 2 * drop;
  camera.fov = (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * (full / h)) * 180) / Math.PI;
  camera.aspect = w / full;
  camera.setViewOffset(w, full, 0, 0, w, h);
  camera.updateProjectionMatrix();
}

export interface Mode {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  tick(dt: number, input: Frame): void;
  dispose(): void;
}

export interface Lit {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  /**
   * Follows `focus`: the camera sits back along CAM from it, the sun's shadows round it. `low`
   * (0..1) swings it down toward the front, for admiring a finished building's face.
   */
  frame(focus: THREE.Vector3, low?: number): void;
}

export function lit(): Lit {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 30, 70);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  const sun = new THREE.DirectionalLight(0xfff6e6, 1.7);
  sun.castShadow = true;
  Quality.useSun(sun);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x6a7a40, 1.35), sun, sun.target);
  return {
    scene,
    camera,
    sun,
    frame(focus, low = 0) {
      // On a tall phone screen, pull back so the scene still fits across.
      const zoom = camera.aspect < 0.8 ? 1.25 : viewZoom;
      const k = low * low * (3 - 2 * low);
      const at = focus.clone().setY(k * 1.2);
      camera.position.copy(at).addScaledVector(CAM.clone().lerp(LOW, k), zoom);
      camera.lookAt(at);
      sun.position.set(focus.x - 8, 20, focus.z + 6);
      sun.target.position.copy(focus);
    },
  };
}

/** Frees what a scene's meshes hold on the GPU (shared materials are left alone). */
export function disposeScene(scene: THREE.Scene, keep: Set<THREE.Material>): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      if (keep.has(mat)) continue;
      const map = (mat as THREE.MeshBasicMaterial).map;
      if (map) map.dispose();
      mat.dispose();
    }
  });
}

/** A short pop: an object swells a little and settles back (a part landing, a house appearing). */
export class Pops {
  private items: { obj: THREE.Object3D; t: number; base: THREE.Vector3; grow: boolean }[] = [];
  add(obj: THREE.Object3D, grow = false): void {
    this.items.push({ obj, t: 0, base: obj.scale.clone(), grow });
  }
  update(dt: number): void {
    for (const p of this.items) {
      p.t += dt / (p.grow ? 0.6 : 0.4);
      const k = Math.min(1, p.t);
      // `grow` comes up from nothing with a bounce; otherwise a swell and back.
      const s = p.grow ? (k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 9) : 1) : 1 + 0.14 * Math.sin(Math.PI * k) * (1 - k * 0.5);
      p.obj.scale.set(p.base.x * s, p.base.y * s, p.base.z * s);
    }
    for (let i = this.items.length - 1; i >= 0; i--)
      if (this.items[i].t >= 1) {
        this.items[i].obj.scale.copy(this.items[i].base);
        this.items.splice(i, 1);
      }
  }
}
