import * as THREE from "three";

/**
 * What tells a player who can't read what to do, all of it in the scene and mid-screen:
 * - a big orange arrow bobbing over the machine to use next, or over the spot to go to;
 * - a pulsing ring on the ground at that spot;
 * - a chevron on the ground by your machine pointing the way, while the spot's far off;
 * - a picture of the button to press, over your machine when it can work, or over the machine
 *   you can hop into. Pictures, not words: a long bar for Space, a green A for a pad.
 */
export type Glyph = "space" | "e" | "padA" | "padY";

function glyphTexture(g: Glyph): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const x = c.getContext("2d")!;
  const round = (l: number, t: number, w: number, h: number, r: number) => {
    x.beginPath();
    x.roundRect(l, t, w, h, r);
  };
  x.lineJoin = "round";
  if (g === "space" || g === "e") {
    const w = g === "space" ? 220 : 104;
    const l = (256 - w) / 2;
    // A keycap: a darker base under a light top, like a key seen from the front.
    round(l, 18, w, 96, 22);
    x.fillStyle = "#3a3f47";
    x.fill();
    round(l + 6, 14, w - 12, 82, 18);
    x.fillStyle = "#ffffff";
    x.fill();
    x.lineWidth = 5;
    x.strokeStyle = "#3a3f47";
    x.stroke();
    x.fillStyle = "#3a3f47";
    if (g === "space") {
      // The space bar's own little mark: a squared-off U.
      x.lineWidth = 9;
      x.beginPath();
      x.moveTo(98, 42);
      x.lineTo(98, 68);
      x.lineTo(158, 68);
      x.lineTo(158, 42);
      x.stroke();
    } else {
      x.font = "bold 66px system-ui, sans-serif";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("E", 128, 58);
    }
  } else {
    const fill = g === "padA" ? "#3fb950" : "#f2c200";
    x.beginPath();
    x.arc(128, 64, 54, 0, Math.PI * 2);
    x.fillStyle = "#2b2f36";
    x.fill();
    x.beginPath();
    x.arc(128, 60, 46, 0, Math.PI * 2);
    x.fillStyle = fill;
    x.fill();
    x.font = "bold 60px system-ui, sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = "#ffffff";
    x.fillText(g === "padA" ? "A" : "Y", 128, 63);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Prompt {
  readonly sprite: THREE.Sprite;
  private textures = new Map<Glyph, THREE.CanvasTexture>();
  private mat: THREE.SpriteMaterial;
  private t = 0;
  constructor(scene: THREE.Scene, private size = 1.1) {
    this.mat = new THREE.SpriteMaterial({ depthTest: false, transparent: true });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.renderOrder = 10;
    this.sprite.visible = false;
    scene.add(this.sprite);
  }
  show(g: Glyph | null, at: THREE.Vector3 | null, dt: number): void {
    if (!g || !at) {
      this.sprite.visible = false;
      this.t = 0;
      return;
    }
    let tex = this.textures.get(g);
    if (!tex) this.textures.set(g, (tex = glyphTexture(g)));
    if (this.mat.map !== tex) {
      this.mat.map = tex;
      this.mat.needsUpdate = true;
    }
    this.t += dt;
    // It pops in, then breathes, so the eye goes to it.
    const pop = Math.min(1, this.t * 6);
    const s = this.size * (pop < 1 ? 0.6 + 0.6 * pop : 1 + 0.08 * Math.sin(this.t * 6));
    this.sprite.scale.set(s, s / 2, 1);
    this.sprite.position.copy(at);
    this.sprite.visible = true;
  }
}

export class Marker {
  readonly arrow: THREE.Sprite;
  readonly ring: THREE.Mesh;
  private chevron: THREE.Mesh;
  private t = 0;

  constructor(scene: THREE.Scene) {
    // A fat down arrow drawn flat and always facing the camera: from the game's high camera a
    // 3D arrow seen from above is just a square.
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.beginPath();
    x.moveTo(40, 8);
    x.lineTo(88, 8);
    x.lineTo(88, 58);
    x.lineTo(116, 58);
    x.lineTo(64, 120);
    x.lineTo(12, 58);
    x.lineTo(40, 58);
    x.closePath();
    x.lineJoin = "round";
    x.lineWidth = 12;
    x.strokeStyle = "#ffffff";
    x.stroke();
    x.fillStyle = "#ff8a1f";
    x.fill();
    x.lineWidth = 4;
    x.strokeStyle = "#c95f00";
    x.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    this.arrow.center.set(0.5, 0);
    this.arrow.scale.set(0.9, 0.9, 1);
    this.arrow.renderOrder = 9;
    scene.add(this.arrow);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.9, 48),
      new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    scene.add(this.ring);

    const shape = new THREE.Shape();
    shape.moveTo(0.42, 0);
    shape.lineTo(-0.1, 0.32);
    shape.lineTo(0.02, 0);
    shape.lineTo(-0.1, -0.32);
    shape.closePath();
    this.chevron = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.chevron.rotation.x = -Math.PI / 2;
    scene.add(this.chevron);
  }

  /**
   * `over`: where the arrow points down at (the top of a machine or a spot). `spot`: where the
   * ring goes, if anywhere. `from`: your machine, for the chevron.
   */
  update(dt: number, over: THREE.Vector3 | null, spot: THREE.Vector3 | null, ringSize: number, from: THREE.Vector3 | null): void {
    this.t += dt;
    this.arrow.visible = over !== null;
    if (over) {
      this.arrow.position.set(over.x, over.y + 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(this.t * 4)), over.z);
    }
    this.ring.visible = spot !== null;
    if (spot) {
      this.ring.position.set(spot.x, spot.y + 0.03, spot.z);
      this.ring.scale.setScalar(ringSize * (1 + 0.07 * Math.sin(this.t * 5)));
    }
    const target = spot ?? over;
    const far = from && target ? Math.hypot(target.x - from.x, target.z - from.z) : 0;
    this.chevron.visible = from !== null && target !== null && far > 3.2;
    if (from && target && this.chevron.visible) {
      const a = Math.atan2(-(target.z - from.z), target.x - from.x);
      const r = 1.9 + 0.15 * Math.sin(this.t * 6);
      this.chevron.position.set(from.x + Math.cos(a) * r, from.y + 0.06, from.z - Math.sin(a) * r);
      this.chevron.rotation.set(-Math.PI / 2, 0, a);
    }
  }
}

/** A see-through copy of the next part of the building, where it'll go. */
export function ghost(mesh: THREE.Mesh): THREE.Mesh {
  const g = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  g.renderOrder = 2;
  return g;
}

/** Fades a ghost in and out gently. */
export function breathe(g: THREE.Object3D, t: number): void {
  const m = (g as THREE.Mesh).material as THREE.MeshBasicMaterial;
  m.opacity = 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(t * 3));
}
