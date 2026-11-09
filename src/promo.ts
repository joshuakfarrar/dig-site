import * as Audio from "./audio";

/**
 * Dev only (`?promo` on the dev server): films the promo video. Each shot sets the game up, then
 * steps it 1/30 s at a time with a scripted camera and controls, drawing every frame at 1920 x 1080
 * and saving it to `capture/` through the dev server. `tools/make_promo.py` then adds the words
 * and the music and makes the MP4.
 *
 * From the console: `promo.still("dig", 1.5)` draws one frame to check a shot; `promo.film()`
 * films them all; `promo.music(32)` records the game's music for the soundtrack.
 */
type Frame = { moveX: number; moveY: number; work: boolean; workPressed: boolean; hopPressed: boolean; restartPressed: boolean; restart: boolean };
type Vec = [number, number, number];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const FPS = 30;
// The size and lens of the cut being filmed (see CUTS).
let W = 1920, H = 1080, FOV = 42;
const idle: Frame = { moveX: 0, moveY: 0, work: false, workPressed: false, hopPressed: false, restartPressed: false, restart: false };
const g = (): Any => (window as Any).game;

interface Shot {
  name: string;
  caption: string;
  seconds: number;
  /** Frames, when it has to land exactly on the beat (the reel); otherwise `seconds` long. */
  frames?: number;
  /** Puts the game where the shot starts (not filmed). */
  setup(): void;
  /** Each frame: where the camera is and looks (at progress `k`, 0 to 1), and what's pressed. */
  frame(t: number, k: number): { eye: Vec; at: Vec; input?: Partial<Frame> };
}

const mix = (a: Vec, b: Vec, k: number): Vec => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const ease = (k: number) => k * k * (3 - 2 * k);

/** Runs the game `seconds` with this input, unfilmed. */
function run(seconds: number, input: Partial<Frame> = {}): void {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) g().mode.tick(1 / 60, { ...idle, ...input, ...(i > 0 ? { workPressed: false } : {}) });
}

/** Steers `m` (anything with `pos`) toward (x, z), unfilmed; true if it got there. */
function driveTo(m: Any, x: number, z: number, near = 0.3, seconds = 12): boolean {
  for (let i = 0; i < seconds * 60; i++) {
    const dx = x - m.pos.x, dz = z - m.pos.y, d = Math.hypot(dx, dz);
    if (d < near) return true;
    g().mode.tick(1 / 60, { ...idle, moveX: dx / d, moveY: -dz / d });
  }
  return false;
}

function town(built: number[][], hood: number): void {
  const game = g();
  game.saved.built = built.map((b) => [...b]);
  game.goHood(hood);
}

// A little story: an empty street, a digger with a big idea, a home, a family, neighbours,
// friends, and in the end a whole town. The captions go on in tools/make_promo.py.
const SHOTS: Shot[] = [
  {
    name: "empty",
    caption: "Once upon a time, there was an empty street.",
    seconds: 4.5,
    setup() {
      town([[]], 0);
      run(2);
    },
    frame(_t, k) {
      const e = ease(k);
      return { eye: mix([-17, 8.5, 9], [-8, 6, 5.5], e), at: mix([-10, 0.2, -5], [-4, 0.4, -5.5], e) };
    },
  },
  {
    name: "dig",
    caption: "Then a little digger got to work.",
    seconds: 4.5,
    setup() {
      g().saved.at = 1;
      g().goBuild(7);
      const b = g().build, e = b.excavator;
      const q = b.site.quadrants.slice().sort((a: Any, c: Any) => a.spot.distanceTo(e.pos) - c.spot.distanceTo(e.pos))[0];
      driveTo(e, q.spot.x, q.spot.y, 0.4);
      run(0.4);
      run(1.2, { work: true, workPressed: true });
    },
    frame(t, k) {
      const e = g().build.excavator.pos;
      const a = 0.9 + k * 0.7;
      return { eye: [e.x + Math.cos(a) * 4.2, 2.6, e.y + Math.sin(a) * 4.2], at: [e.x + 0.6, 0.5, e.y - 0.4], input: { work: true, workPressed: t === 0 } };
    },
  },
  {
    name: "pour",
    caption: "Some concrete for the floor...",
    seconds: 3.5,
    setup() {
      g().saved.at = 0;
      g().goBuild(2, "pour");
      const m = g().build.mixer, F = g().build.site.foot;
      driveTo(m, m.pos.x, 3.4, 0.3);
      driveTo(m, F.cx - 0.6, 3.4, 0.3);
      driveTo(m, F.cx - 0.6, 2.2, 0.3);
      // Over the pit already, so the chute (well behind the cab) is pouring as the shot starts.
      driveTo(m, F.cx - 0.6, -0.9, 0.3);
    },
    frame() {
      const m = g().build.mixer.pos;
      return { eye: [m.x + 5.2, 3.4, m.y + 3.4], at: [m.x - 0.2, 0.3, m.y + 0.6], input: { moveY: 0.32 } };
    },
  },
  {
    name: "crane",
    caption: "...walls, and a roof, lifted just so.",
    seconds: 6,
    setup() {
      g().saved.at = 0;
      g().goBuild(0, "roof");
      run(1.2); // the pictures ignore presses for a moment after they come up
      run(0.5, { work: true, workPressed: true }); // pick the roof's colour
      run(0.5);
      // Round the house (not through it) to the roof on its pallet.
      const c = g().build.crane;
      driveTo(c, 6.4, 2.8, 0.4);
      driveTo(c, -5.2, 2.8, 0.4);
      driveTo(c, -5.2, -1.6, 0.25);
      run(0.4);
    },
    frame(t, k) {
      // Hook the roof on and lift it; then a few steps toward the house, stop, and lower it on.
      const c = g().build.crane;
      const f = Math.round(t * FPS);
      let input: Partial<Frame> = {};
      if (t < 0.05) input = { work: true, workPressed: true };
      else if (!c.busy() && c.load) {
        // Work only counts once the crane has stopped.
        const dx = -3.6 - c.pos.x, dz = -1.6 - c.pos.y, d = Math.hypot(dx, dz);
        if (d > 0.2) input = { moveX: (dx / d) * 0.7, moveY: (-dz / d) * 0.7 };
        else if (Math.abs(c.speed) < 0.1 && f % 4 === 0) input = { work: true, workPressed: true };
      }
      void k;
      return { eye: [-0.2, 5.4, 7.8], at: [-2.6, 1.4, -1.6], input };
    },
  },
  {
    name: "home",
    caption: "And a family moved in.",
    seconds: 5,
    setup() {
      // Back from building lot 0: it pops up, its people come out, confetti.
      const game = g();
      game.saved.built = [[0]];
      game.saved.at = 0;
      game.goTown(0);
    },
    frame(_t, k) {
      const e = ease(k);
      return { eye: mix([-8.6, 3.4, 2.6], [-9.4, 3.9, 3.4], e), at: [-12, 1.1, -5.6] };
    },
  },
  {
    name: "neighbours",
    caption: "Soon there were neighbours...",
    seconds: 5,
    setup() {
      town([[0, 1, 2, 3, 4, 5, 6]], 0);
      run(3);
    },
    frame(_t, k) {
      const e = ease(k);
      return { eye: mix([-18, 7.2, 3.2], [8, 7.2, 3.2], e), at: mix([-13, 0.8, -5.5], [13, 0.8, -5.5], e) };
    },
  },
  {
    name: "play",
    caption: "...and friends to play with.",
    seconds: 5,
    setup() {
      town([[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6]], 1);
      run(6);
    },
    frame(_t, k) {
      const a = 1.15 + k * 0.45;
      return { eye: [4 + Math.cos(a) * 6.2, 3.6, 3.8 + Math.sin(a) * 6.2], at: [4, 0.7, 3.6] };
    },
  },
  {
    name: "town",
    caption: "Street by street, a whole community.",
    seconds: 6,
    setup() {
      town([[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7]], 2);
      run(3);
    },
    frame(_t, k) {
      const e = ease(k);
      return { eye: mix([-6, 5.5, 22], [16, 6.5, 20], e), at: mix([-4, 1, 5], [12, 1.6, 4], e) };
    },
  },
];

// ------------------------------------------------------------------ the reel

/**
 * The reel: vertical (9:16) for phones, about 28 seconds, every cut on the beat of a 120 bpm tune
 * (a beat is 15 frames). Close-ups with a big word each (dig, pour, build, welcome home), then
 * the street filling up one house a beat, the playground, a few plain truths, and the card.
 * `tools/make_reel.py` adds the words, the tune and the card.
 */
const BEAT = 15;
// The near row first, from the far end (all four big and clear), then the far row filling in
// behind, nearest first.
const POPS = [4, 5, 6, 7, 3, 2, 1, 0];
// A new building waits about 0.45 s before it pops up (for the fade from its site to clear); run
// that much first, so the pop lands on the beat.
const POP_LEAD = 0.43;
// High over the east end of the second street (road B), looking west down it. Every house in
// Home Street faces south: the near row faces this street, and the far row shows its fronts over
// their gardens. (Down the first street instead, the near row shows its back gardens.) The park's
// on the other side.
const STREET_EYE: Vec = [16, 11.5, 13.5];
const STREET_AT: Vec = [-4, 0, 3];
let popped = -1;

const REEL: Shot[] = [
  {
    name: "r_dig",
    caption: "DIG!",
    seconds: 0,
    frames: 4 * BEAT,
    setup() {
      g().saved.at = 1;
      g().goBuild(7);
      const b = g().build, e = b.excavator;
      const q = b.site.quadrants.slice().sort((a: Any, c: Any) => a.spot.distanceTo(e.pos) - c.spot.distanceTo(e.pos))[0];
      driveTo(e, q.spot.x, q.spot.y, 0.4);
      run(0.4);
      run(1.0, { work: true, workPressed: true });
    },
    frame(t, k) {
      const e = g().build.excavator.pos;
      const a = 0.75 + k * 0.45;
      return { eye: [e.x + Math.cos(a) * 4.4, 3.1, e.y + Math.sin(a) * 4.4], at: [e.x + 0.3, 0.6, e.y - 0.2], input: { work: true, workPressed: t === 0 } };
    },
  },
  {
    name: "r_pour",
    caption: "POUR!",
    seconds: 0,
    frames: 3 * BEAT,
    setup() {
      g().saved.at = 0;
      g().goBuild(2, "pour");
      const m = g().build.mixer, F = g().build.site.foot;
      driveTo(m, m.pos.x, 3.4, 0.3);
      driveTo(m, F.cx - 0.6, 3.4, 0.3);
      driveTo(m, F.cx - 0.6, 2.2, 0.3);
      driveTo(m, F.cx - 0.6, -0.4, 0.3);
    },
    frame() {
      const m = g().build.mixer.pos;
      return { eye: [m.x + 3.4, 2.9, m.y + 3.2], at: [m.x - 0.2, 0.4, m.y + 0.9], input: { moveY: 0.32 } };
    },
  },
  {
    name: "r_roof",
    caption: "BUILD!",
    seconds: 0,
    frames: 5 * BEAT,
    setup() {
      // Everything up to the moment the roof starts down onto the walls, unfilmed.
      g().saved.at = 0;
      g().goBuild(0, "roof");
      run(1.2);
      run(0.5, { work: true, workPressed: true });
      run(0.5);
      const c = g().build.crane;
      driveTo(c, 6.4, 2.8, 0.4);
      driveTo(c, -5.2, 2.8, 0.4);
      driveTo(c, -5.2, -1.6, 0.25);
      run(0.4);
      run(0.1, { work: true, workPressed: true });
      for (let i = 0; i < 400 && c.busy(); i++) run(1 / 60);
      driveTo(c, -3.6, -1.6, 0.2);
      for (let i = 0; i < 120 && Math.abs(c.speed) > 0.05; i++) run(1 / 60);
    },
    frame(t) {
      return { eye: [-0.6, 4.4, 5.6], at: [-1.3, 1.5, -1.6], input: { work: t < 0.05, workPressed: t === 0 } };
    },
  },
  {
    name: "r_home",
    caption: "WELCOME HOME!",
    seconds: 0,
    frames: 3 * BEAT,
    setup() {
      const game = g();
      game.saved.built = [[0]];
      game.saved.at = 0;
      game.goTown(0);
      game.town.truck.root.visible = false;
      run(POP_LEAD); // so the house pops up right on the cut
    },
    frame(_t, k) {
      return { eye: mix([-10.9, 3.0, 1.2], [-11.2, 3.4, 1.9], k), at: [-12, 1.5, -5.6] };
    },
  },
  {
    name: "r_street",
    caption: "",
    seconds: 0,
    frames: 12 * BEAT,
    setup() {
      town([[]], 0);
      g().town.truck.root.visible = false;
      popped = -1;
    },
    frame(t) {
      // One beat of the empty street, then a house a beat (each its own little party), then the last
      // one's confetti settling.
      const f = Math.round(t * FPS);
      const k = Math.floor(f / BEAT) - 1;
      if (k >= 0 && k < POPS.length && k !== popped) {
        popped = k;
        const game = g();
        game.saved.built = [POPS.slice(0, k + 1)];
        game.saved.at = 0;
        game.goTown(POPS[k]);
        game.town.truck.root.visible = false;
        run(POP_LEAD); // the house pops up on this beat, with its chime
      }
      return { eye: STREET_EYE, at: STREET_AT };
    },
  },
  {
    name: "r_dusk",
    caption: "",
    seconds: 0,
    frames: 4 * BEAT,
    setup() {
      town([[0, 1, 2, 3, 4, 5, 6, 7]], 0);
      g().town.truck.root.visible = false;
      run(2);
    },
    frame(_t, k) {
      return { eye: mix(STREET_EYE, [STREET_EYE[0] - 1.5, STREET_EYE[1] - 0.8, STREET_EYE[2]], k), at: STREET_AT };
    },
  },
  {
    name: "r_play",
    caption: "",
    seconds: 0,
    frames: 8 * BEAT,
    setup() {
      town([[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6]], 1);
      run(6);
    },
    frame(_t, k) {
      const a = 1.25 + k * 0.5;
      return { eye: [4 + Math.cos(a) * 4.6, 3.3, 3.5 + Math.sin(a) * 4.6], at: [4, 0.8, 3.5] };
    },
  },
  {
    name: "r_roller",
    caption: "",
    seconds: 0,
    frames: 2 * BEAT,
    setup() {
      g().saved.at = 0;
      g().goBuild(0, "path");
      run(1.5);
      const r = g().build.roller, F = g().build.site.foot;
      driveTo(r, F.cx - 1.6, F.maxZ + 0.8, 0.3);
      driveTo(r, F.cx, F.maxZ + 0.8, 0.25);
      run(0.6);
    },
    frame() {
      const r = g().build.roller.pos;
      return { eye: [r.x + 2.6, 2.0, r.y + 2.6], at: [r.x, 0.4, r.y + 0.6], input: { moveY: -0.45 } };
    },
  },
  {
    name: "r_fork",
    caption: "",
    seconds: 0,
    frames: 2 * BEAT,
    setup() {
      town([[0, 1]], 0);
      const t = g().town.truck;
      driveTo(t, t.pos.x, 6.5, 0.3);
      driveTo(t, -18.75, 4.5, 0.25);
      run(1);
      run(0.35, { work: true, workPressed: true });
    },
    frame() {
      return { eye: [-16.6, 2.5, 7.2], at: [-19.9, 0.7, 4.5] };
    },
  },
  {
    name: "r_sweep",
    caption: "",
    seconds: 0,
    frames: 2 * BEAT,
    setup() {
      g().saved.at = 2;
      g().goBuild(0, "sweep");
      run(1);
      // The drift furthest from the parked excavator, so nothing's in the way.
      const b = g().build, sw = b.sweeper, ex = b.excavator.pos;
      const near = b.sand.slice().sort((a: Any, c: Any) => Math.hypot(c.x - ex.x, c.z - ex.y) - Math.hypot(a.x - ex.x, a.z - ex.y))[0];
      const dx = near.x - sw.pos.x, dz = near.z - sw.pos.y, d = Math.hypot(dx, dz);
      driveTo(sw, near.x - (dx / d) * 1.6, near.z - (dz / d) * 1.6, 0.3);
      sweepAt = [near.x, near.z];
    },
    frame() {
      const sw = g().build.sweeper.pos;
      const dx = sweepAt[0] - sw.x, dz = sweepAt[1] - sw.y, d = Math.max(0.01, Math.hypot(dx, dz));
      return { eye: [sw.x - (dx / d) * 2.2 + 2.6, 3.1, sw.y - (dz / d) * 2.2 + 2.6], at: [sw.x + (dx / d) * 0.8, 0.3, sw.y + (dz / d) * 0.8], input: { moveX: (dx / d) * 0.6, moveY: (-dz / d) * 0.6 } };
    },
  },
  {
    name: "r_harbour",
    caption: "",
    seconds: 0,
    frames: 4 * BEAT,
    setup() {
      town([[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7]], 2);
      run(3);
    },
    frame(_t, k) {
      const e = ease(k);
      return { eye: mix([8.5, 4.2, 16.5], [14.5, 5.6, 13.5], e), at: mix([11, 1.4, 4], [12, 2.2, 4], e) };
    },
  },
];
let sweepAt: [number, number] = [0, 0];

/** Each cut: its shots, frame size and lens. */
const CUTS: Record<string, { shots: Shot[]; w: number; h: number; fov: number }> = {
  story: { shots: SHOTS, w: 1920, h: 1080, fov: 42 },
  reel: { shots: REEL, w: 1080, h: 1920, fov: 58 },
};
const cutOf = (name: string) => Object.values(CUTS).find((c) => c.shots.some((s) => s.name === name))!;
function useCut(c: { w: number; h: number; fov: number }): void {
  W = c.w;
  H = c.h;
  FOV = c.fov;
}

const canvas = (): HTMLCanvasElement => g().renderer.domElement;

/** Draws at video size, through the shot's camera. */
function draw(eye: Vec, at: Vec): void {
  const game = g();
  // The shot's camera, set straight on the game's camera after its own step has placed it (not
  // through another step, which would brake whatever's driving), with the video's own lens rather
  // than the window's (a hidden window can measure 0 x 0).
  const cam = game.mode.camera;
  cam.position.set(...eye);
  cam.lookAt(...at);
  cam.clearViewOffset();
  cam.fov = FOV;
  cam.aspect = W / H;
  cam.updateProjectionMatrix();
  // No keyboard-key hints floating over the machines in a video.
  game.mode.scene.traverse((o: Any) => {
    if (o.isSprite) o.visible = false;
  });
  game.renderer.setPixelRatio(1);
  game.renderer.setSize(W, H, false);
  game.renderer.render(game.mode.scene, cam);
}

let frameNo = 0;
let sending: Promise<unknown>[] = [];
/**
 * Saves the frame just drawn. Encoded straight away (a hidden page puts `toBlob` at the back of
 * the queue) and sent without waiting; `flush` waits for them all.
 */
async function save(): Promise<void> {
  const url = canvas().toDataURL("image/jpeg", 0.92);
  const bytes = Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (c) => c.charCodeAt(0));
  sending.push(fetch(`/__capture/frame/${String(frameNo++).padStart(4, "0")}`, { method: "POST", body: bytes }));
  if (sending.length >= 24) await flush();
}
async function flush(): Promise<void> {
  await Promise.all(sending);
  sending = [];
}

const framesOf = (s: Shot) => s.frames ?? Math.round(s.seconds * FPS);

function stepShot(s: Shot, f: number): void {
  const n = framesOf(s);
  const t = f / FPS;
  const { eye, at, input } = s.frame(t, n > 1 ? f / (n - 1) : 0);
  const i = { ...idle, ...input };
  g().mode.tick(1 / 60, i);
  g().mode.tick(1 / 60, { ...i, workPressed: false, hopPressed: false });
  draw(eye, at);
}

const promo = {
  cuts: Object.fromEntries(Object.entries(CUTS).map(([k, c]) => [k, c.shots.map((s) => s.name)])),
  /** Sets up shot `name` and draws its frame at `t` seconds, to look at. */
  still(name: string, t = 0): void {
    const c = cutOf(name);
    useCut(c);
    const s = c.shots.find((x) => x.name === name)!;
    s.setup();
    const n = Math.round(t * FPS);
    for (let f = 0; f <= n; f++) stepShot(s, f);
  },
  /** Draws shot `name` at `t` seconds and saves it as `capture/frames/9NNN.jpg`, to check. */
  async proof(name: string, t = 0, k = 0): Promise<void> {
    promo.still(name, t);
    const was = frameNo;
    frameNo = 9000 + k;
    await save();
    await flush();
    frameNo = was;
    dispatchEvent(new Event("resize"));
  },
  /** Films every shot of `cut` ("story" or "reel"), or just those named, into `capture/`. */
  async film(cut = "story", names?: string[]): Promise<string> {
    const c = CUTS[cut];
    useCut(c);
    await fetch("/__capture/reset", { method: "POST" });
    frameNo = 0;
    const list: { name: string; caption: string; from: number; frames: number }[] = [];
    for (const s of c.shots.filter((x) => !names || names.includes(x.name))) {
      s.setup();
      const n = framesOf(s);
      list.push({ name: s.name, caption: s.caption, from: frameNo, frames: n });
      for (let f = 0; f < n; f++) {
        stepShot(s, f);
        await save();
      }
    }
    await flush();
    await fetch("/__capture/manifest", { method: "POST", body: JSON.stringify({ cut, fps: FPS, width: W, height: H, shots: list }) });
    dispatchEvent(new Event("resize"));
    return `${frameNo} frames`;
  },
  /** Records `seconds` of the game's music (it plays in real time) for the soundtrack. */
  async music(seconds: number): Promise<string> {
    Audio.unlock();
    Audio.setEngine(0, false);
    const stream = Audio.tap();
    if (!stream) return "no audio";
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => parts.push(e.data);
    const done = new Promise<void>((r) => (rec.onstop = () => r()));
    const keep = setInterval(() => Audio.music(), 50);
    rec.start();
    await new Promise((r) => setTimeout(r, seconds * 1000));
    rec.stop();
    await done;
    clearInterval(keep);
    await fetch("/__capture/audio", { method: "POST", body: new Blob(parts, { type: "audio/webm" }) });
    return `${(parts.reduce((n, p) => n + p.size, 0) / 1024).toFixed(0)} KB`;
  },
};

Object.assign(window, { promo });
