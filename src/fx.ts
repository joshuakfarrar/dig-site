import * as THREE from "three";

/**
 * Little cubes for every effect: dust puffs that swell and shrink away, dirt clods and concrete
 * blobs that fall, confetti that flutters. All one instanced mesh; nothing fades by opacity, so
 * there's no sorting to get wrong. Plus flat rings that spread out on the ground for a "done".
 */
interface P {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  gravity: number;
  drag: number;
  age: number;
  life: number;
  size: number;
  grow: boolean; // puffs swell then shrink; bits just shrink at the end
  spin: THREE.Vector3;
  rot: THREE.Euler;
  color: THREE.Color;
  floor: number;
}

const MAX = 900;

export class Fx {
  private mesh: THREE.InstancedMesh;
  private ps: P[] = [];
  private rings: { m: THREE.Mesh; age: number; life: number; size: number }[] = [];
  private tmp = new THREE.Object3D();
  private ringGeo = new THREE.RingGeometry(0.85, 1, 48);

  constructor(private scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    scene.add(this.mesh);
  }

  private add(p: Partial<P> & { pos: THREE.Vector3 }): void {
    if (this.ps.length >= MAX) this.ps.shift();
    this.ps.push({
      vel: new THREE.Vector3(),
      gravity: 0,
      drag: 0,
      age: 0,
      life: 1,
      size: 0.1,
      grow: false,
      spin: new THREE.Vector3(),
      rot: new THREE.Euler(),
      color: new THREE.Color(0xffffff),
      floor: -99,
      ...p,
    });
  }

  /** A soft cloud of dust rising from `at`, spread over `radius`. */
  dust(at: THREE.Vector3, radius: number, count = 14, color = 0xe6d2ae): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * Math.sqrt(Math.random());
      this.add({
        pos: new THREE.Vector3(at.x + Math.cos(a) * r, at.y + Math.random() * 0.15, at.z + Math.sin(a) * r),
        vel: new THREE.Vector3(Math.cos(a) * 0.6, 0.4 + Math.random() * 0.6, Math.sin(a) * 0.6),
        drag: 2,
        life: 0.7 + Math.random() * 0.5,
        size: 0.16 + Math.random() * 0.14,
        grow: true,
        color: new THREE.Color(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08),
        rot: new THREE.Euler(Math.random(), Math.random(), Math.random()),
      });
    }
  }

  /** A ring of dust all round a rectangle's edge: a section landing. */
  dustRect(cx: number, y: number, cz: number, w: number, d: number, per = 1.4): void {
    const n = Math.ceil(((w + d) * 2) * per);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const along = t * (w + d) * 2;
      let x: number, z: number, nx: number, nz: number;
      if (along < w) [x, z, nx, nz] = [cx - w / 2 + along, cz - d / 2, 0, -1];
      else if (along < w + d) [x, z, nx, nz] = [cx + w / 2, cz - d / 2 + (along - w), 1, 0];
      else if (along < w * 2 + d) [x, z, nx, nz] = [cx + w / 2 - (along - w - d), cz + d / 2, 0, 1];
      else [x, z, nx, nz] = [cx - w / 2, cz + d / 2 - (along - 2 * w - d), -1, 0];
      this.add({
        pos: new THREE.Vector3(x, y + 0.05, z),
        vel: new THREE.Vector3(nx * (1 + Math.random()), 0.3 + Math.random() * 0.5, nz * (1 + Math.random())),
        drag: 2.4,
        life: 0.8 + Math.random() * 0.4,
        size: 0.16 + Math.random() * 0.14,
        grow: true,
        color: new THREE.Color(0xf1e6d2).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08),
        rot: new THREE.Euler(Math.random(), Math.random(), Math.random()),
      });
    }
  }

  /** Clods that fly up and fall to `floor`, for a dump or a scoop. */
  bits(at: THREE.Vector3, count: number, color: number, speed = 1.5, floor = 0, size = 0.09): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({
        pos: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)),
        vel: new THREE.Vector3(Math.cos(a) * speed * Math.random(), speed * (0.4 + Math.random()), Math.sin(a) * speed * Math.random()),
        gravity: 9,
        life: 0.9 + Math.random() * 0.5,
        size: size * (0.7 + Math.random() * 0.6),
        color: new THREE.Color(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        floor,
      });
    }
  }

  /** A blob of concrete dropping from the chute. */
  drip(at: THREE.Vector3, vel: THREE.Vector3, floor: number): void {
    this.add({
      pos: at.clone(),
      vel: vel.clone(),
      gravity: 9,
      life: 0.6,
      size: 0.1 + Math.random() * 0.05,
      color: new THREE.Color(0x8f969c).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06),
      floor,
    });
  }

  confetti(at: THREE.Vector3, count: number): void {
    const colors = [0xff5d5d, 0xffc93c, 0x3fb950, 0x4aa8ff, 0xc77dff, 0xff8a1f];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 4;
      this.add({
        pos: at.clone(),
        vel: new THREE.Vector3(Math.cos(a) * s * 0.6, 5 + Math.random() * 5, Math.sin(a) * s * 0.6),
        gravity: 6,
        drag: 1.2,
        life: 3 + Math.random() * 1.5,
        size: 0.1 + Math.random() * 0.06,
        color: new THREE.Color(colors[i % colors.length]),
        spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        floor: 0.02,
      });
    }
  }

  /** A flat ring spreading over the ground from `at`. */
  ring(at: THREE.Vector3, size: number, color = 0xffffff): void {
    const m = new THREE.Mesh(
      this.ringGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at).setY(at.y + 0.04);
    this.scene.add(m);
    this.rings.push({ m, age: 0, life: 0.7, size });
  }

  update(dt: number): void {
    let n = 0;
    const keep: P[] = [];
    for (const p of this.ps) {
      p.age += dt;
      if (p.age >= p.life) continue;
      keep.push(p);
      p.vel.y -= p.gravity * dt;
      if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < p.floor + p.size / 2) {
        p.pos.y = p.floor + p.size / 2;
        p.vel.set(p.vel.x * 0.3, 0, p.vel.z * 0.3);
        p.spin.multiplyScalar(0.5);
      }
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      const k = p.age / p.life;
      const s = p.grow ? p.size * Math.sin(Math.PI * Math.min(1, k * 1.2)) : p.size * (k > 0.75 ? (1 - k) / 0.25 : 1);
      this.tmp.position.copy(p.pos);
      this.tmp.rotation.copy(p.rot);
      this.tmp.scale.setScalar(Math.max(0.001, s));
      this.tmp.updateMatrix();
      this.mesh.setMatrixAt(n, this.tmp.matrix);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.ps = keep;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.rings = this.rings.filter((r) => {
      r.age += dt;
      const k = r.age / r.life;
      if (k >= 1) {
        this.scene.remove(r.m);
        (r.m.material as THREE.Material).dispose();
        return false;
      }
      r.m.scale.setScalar(r.size * (0.3 + 0.7 * Math.sqrt(k)));
      (r.m.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
      return true;
    });
  }
}
