import * as THREE from "three";
import * as Quality from "./quality";
import { Faces, voxelMaterial } from "./voxel";

/**
 * Little plants scattered over open grass so it isn't one flat green: tufts of grass, taller
 * grasses, clumps of wildflowers, small bushes and the odd rock. All of it goes into one mesh (one
 * draw), it casts no shadows, and there's less of it on a weaker device.
 */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const GREENS = [0x5fb35a, 0x6cc25e, 0x4fa64d, 0x7ccf63];
const TALL = [0x9ccf5a, 0xb5d86a, 0x8cc451];
const FLOWERS = [0xffffff, 0xffd34d, 0xff8fb8, 0xc77dff, 0xff7a5a, 0x7ec8ff];
const BUSH = [0x3f9a45, 0x4fae4a, 0x3a8a40];
const ROCK = [0xa7a39b, 0x948f86, 0xb8b4ac];

export function scatterFlora(parent: THREE.Object3D, area: Rect, avoid: Rect[], count: number, seed: number): void {
  const scale = { high: 1, medium: 0.6, low: 0.35 }[Quality.current()];
  const n = Math.round(count * scale);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const blocked = (x: number, z: number) => avoid.some((b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ);
  const f = new Faces();
  const sides = (d: [number, number, number]) => d[1] !== -1;
  let placed = 0;
  for (let tries = 0; placed < n && tries < n * 4; tries++) {
    const x = area.minX + r() * (area.maxX - area.minX);
    const z = area.minZ + r() * (area.maxZ - area.minZ);
    if (blocked(x, z)) continue;
    placed++;
    const kind = r();
    if (kind < 0.5) {
      // A tuft of grass: a few thin blades of slightly different greens and heights.
      const blades = 3 + Math.floor(r() * 3);
      for (let k = 0; k < blades; k++)
        f.box(x + (r() - 0.5) * 0.14, 0, z + (r() - 0.5) * 0.14, 0.035, 0.07 + r() * 0.11, 0.035, pick(GREENS), sides);
    } else if (kind < 0.62) {
      // Taller grass, paler, swaying-looking.
      for (let k = 0; k < 6; k++) f.box(x + (r() - 0.5) * 0.22, 0, z + (r() - 0.5) * 0.22, 0.03, 0.18 + r() * 0.16, 0.03, pick(TALL), sides);
    } else if (kind < 0.84) {
      // A clump of wildflowers: stems and bright heads, all one colour.
      const c = pick(FLOWERS);
      const stems = 3 + Math.floor(r() * 3);
      for (let k = 0; k < stems; k++) {
        const fx = x + (r() - 0.5) * 0.24, fz = z + (r() - 0.5) * 0.24, h = 0.08 + r() * 0.1;
        f.box(fx, 0, fz, 0.025, h, 0.025, 0x4fa64d, sides);
        f.box(fx - 0.02, h, fz - 0.02, 0.065, 0.05, 0.065, c, sides);
      }
    } else if (kind < 0.93) {
      // A small round bush.
      const c = pick(BUSH);
      const w = 0.22 + r() * 0.14;
      f.box(x - w / 2, 0, z - w / 2, w, w * 0.8, w, c, sides);
      f.box(x - w * 0.35, w * 0.8, z - w * 0.35, w * 0.7, w * 0.3, w * 0.7, c, sides);
    } else {
      // A rock or two.
      const w = 0.1 + r() * 0.14;
      f.box(x - w / 2, 0, z - w / 2, w, w * 0.6, w * 0.8, pick(ROCK), sides);
      if (r() < 0.5) f.box(x + w * 0.4, 0, z, w * 0.5, w * 0.35, w * 0.5, pick(ROCK), sides);
    }
  }
  const mesh = new THREE.Mesh(f.geometry(), voxelMaterial);
  mesh.receiveShadow = true;
  parent.add(mesh);
}
