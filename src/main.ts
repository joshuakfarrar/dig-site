import * as THREE from "three";
import * as Audio from "./audio";
import * as Hud from "./hud";
import * as Input from "./input";
import * as B from "./blueprints";
import * as Save from "./save";
import * as Quality from "./quality";
import * as Shop from "./shop";
import * as Grownups from "./grownups";
import { createBuild, STAGES, type BuildMode, type Stage } from "./build";
import { createTown, type TownMode } from "./town";
import { fitCamera, setViewZoom, type Mode } from "./stage";
import { App } from "@capacitor/app";

/**
 * The game: the town, and a building site for whichever lot you picked. One renderer and one
 * loop; a quick fade to sky blue between the two.
 */
const renderer = new THREE.WebGLRenderer({ antialias: Quality.settings().antialias, powerPreference: "high-performance" });
Quality.useRenderer(renderer);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById("app")!.appendChild(renderer.domElement);

let mode: Mode;
let town: TownMode | null = null;
let build: BuildMode | null = null;
let switching = false;
let saved = Save.load();

function fit(m: Mode): void {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  // A phone on its side is short: come in closer so the machines and prompts are a good size.
  setViewZoom(h < 500 ? 0.8 : 1);
  // On a tall phone screen, widen the view so the scene still fits across. The middle sits a bit
  // low, clear of the progress strip along the top.
  fitCamera(m.camera, w, h, w / h < 0.8 ? 62 : 50, Math.round(Math.min(64, h * 0.12)));
}
addEventListener("resize", () => mode && fit(mode));

function use(m: Mode): void {
  const old = mode;
  mode = m;
  fit(m);
  if (old && old !== m) old.dispose();
}

/**
 * The town you're in (`saved.at`). `arrived`: the lot you've just built, back from its site.
 * `via`: came through the gate from the next neighbourhood ("next") or the one before ("back").
 */
function goTown(arrived: number | null, via: "next" | "back" | null = null): void {
  build = null;
  const h = saved.at;
  town = createTown(h, new Set(Save.builtIn(saved, h)), arrived, via, (i) => saved.looks[`${h}:${i}`], {
    build: (i) => void switchTo(() => goBuild(i)),
    travel: (to) =>
      void switchTo(() => {
        saved.at = to;
        Save.save(saved);
        goTown(null, to > h ? "back" : "next");
      }),
    controls: Input.controls,
    hints: Input.hints,
    locked: () => Shop.locked(builtSoFar()),
    askGrownUp: () => {
      grownButton.classList.remove("nudge");
      void grownButton.offsetWidth;
      grownButton.classList.add("nudge");
    },
  });
  use(town);
  Hud.corner("fresh", () =>
    void switchTo(() => {
      Save.clear();
      saved = Save.fresh();
      goTown(null);
    }),
  );
}

function goBuild(i: number, at?: Stage): void {
  town = null;
  Hud.nudge(false);
  const h = saved.at;
  build = createBuild(B.HOODS[h].lots[i], {
    finished: (looks) =>
      void switchTo(() => {
        if (looks[0] || looks[1]) saved.looks[`${h}:${i}`] = looks;
        const built = Save.builtIn(saved, h);
        if (!built.includes(i)) built.push(i);
        Save.save(saved);
        goTown(i);
      }),
    controls: Input.controls,
    hints: Input.hints,
  });
  if (at) build.skipTo(at);
  use(build);
  Hud.corner("home", () => void switchTo(() => goTown(null)));
}

/** Every lot built, in every neighbourhood: the free tier counts these. */
function builtSoFar(): number {
  return saved.built.reduce((n, lots) => n + lots.length, 0);
}

// The grown-ups' padlock button, top left: only in town, and only while lots are locked. It opens
// the parent gate, then the unlock; once bought, the padlocks go and the town carries on.
const grownButton = document.getElementById("grown") as HTMLButtonElement;
grownButton.addEventListener("click", () =>
  Grownups.show(() => {
    Audio.fanfare();
    grownButton.classList.remove("nudge");
  }),
);

/** Fades out, swaps, fades back in; input's ignored meanwhile. */
async function switchTo(go: () => void): Promise<void> {
  if (switching) return;
  switching = true;
  await Hud.fade(true);
  go();
  // A frame drawn behind the fade, so the new scene's there when it clears.
  mode.tick(1 / 60, idle);
  renderer.render(mode.scene, mode.camera);
  await Hud.fade(false);
  switching = false;
}

const idle: Input.Frame = { moveX: 0, moveY: 0, work: false, workPressed: false, hopPressed: false, restartPressed: false, restart: false };

function tick(dt: number, read: Input.Frame): void {
  const pressed = read.workPressed || read.hopPressed || read.moveX !== 0 || read.moveY !== 0;
  if (pressed) Audio.unlock();
  // On the title, the first press starts; the town waits behind it.
  if (Hud.titleUp()) {
    if (pressed) Hud.startPlay();
    read = idle;
  }
  // The grown-ups' screens are up: the game waits.
  if (Grownups.open()) read = idle;
  grownButton.hidden = !(town && Shop.locked(builtSoFar()));
  const input = switching ? idle : read;
  mode.tick(dt, input);
  Hud.updateHold(dt, input.restart);
  Audio.music();
}

let last = performance.now();
let paused = false;
function frame(now: number): void {
  const real = (now - last) / 1000;
  const dt = Math.min(0.05, real);
  last = now;
  if (!paused && mode) {
    Quality.frame(real);
    tick(dt, Input.read());
    renderer.render(mode.scene, mode.camera);
  }
  requestAnimationFrame(frame);
}

// In the background (another app, a locked screen): everything stops and goes quiet, and picks
// up where it was on coming back.
document.addEventListener("visibilitychange", () => {
  paused = document.visibilityState === "hidden";
  Audio.pause(paused);
  last = performance.now();
});

// The sound button steps through loud, medium, quiet and off; its waves show which.
const soundButton = document.getElementById("mute")!;
soundButton.dataset.level = String(Audio.volume());
soundButton.addEventListener("click", () => {
  Audio.unlock();
  soundButton.dataset.level = String(Audio.nextVolume());
});
addEventListener("pointerdown", () => Audio.unlock());

// Android's back button. On the title it closes the game as usual; in play it never throws a
// child's work away by accident: it just makes the hold-to-confirm corner button bounce, so a
// grown-up can see how to leave. (In a browser this never fires.)
void App.addListener("backButton", () => {
  if (Grownups.open()) Grownups.close();
  else if (Hud.titleUp()) void App.exitApp();
  else Hud.flash();
});

// Dev aids: `?hood=1` starts in that neighbourhood, `?lot=3` goes straight to that lot's site,
// `&stage=walls` further on into it.
const params = new URLSearchParams(location.search);
const hoodParam = Number(params.get("hood"));
if (import.meta.env.DEV && Number.isInteger(hoodParam) && B.HOODS[hoodParam]) saved.at = hoodParam;
if (saved.at >= B.HOODS.length) saved.at = 0;
const lotParam = params.get("lot");
const stageParam = params.get("stage") as Stage | null;
// The promo video's camera script (dev server only): `?promo`, then `promo.film()` in the console.
if (import.meta.env.DEV && params.has("promo")) void import("./promo");
if (import.meta.env.DEV && params.has("lineup")) {
  // The art review page: every machine side by side (dev server only; not in the released game).
  void import("./lineup").then((m) => use(m.createLineup()));
} else if (lotParam !== null && B.HOODS[saved.at].lots[Number(lotParam)])
  goBuild(Number(lotParam), stageParam && STAGES.includes(stageParam) ? stageParam : undefined);
else {
  goTown(null);
  // The title first, unless a dev link asked for somewhere in particular.
  if (!params.has("hood")) Hud.title(() => Audio.unlock());
}
// The page starts covered, bricks hopping, while the game loads; it clears once the first frame's drawn.
requestAnimationFrame(() => requestAnimationFrame(() => void Hud.fade(false)));

// For poking at it from the console (and for checking renders); not in the released game.
if (import.meta.env.DEV) Object.assign(window, {
  game: {
    get mode() { return mode; },
    get town() { return town?.debug; },
    get build() { return build?.debug; },
    renderer,
    shop: Shop,
    goTown,
    goBuild,
    /** Jumps to neighbourhood `h` (not saved). */
    goHood(h: number) {
      saved.at = h;
      goTown(null);
    },
    get saved() { return saved; },
    /** Steps the game `seconds` at 60 Hz with this input held, then draws (a hidden tab's frames are throttled). */
    advance(seconds: number, held: Partial<Input.Frame> = {}) {
      const steps = Math.round(seconds * 60);
      for (let i = 0; i < steps; i++) tick(1 / 60, { ...idle, ...held, ...(i > 0 ? { workPressed: false, hopPressed: false } : {}) });
      renderer.render(mode.scene, mode.camera);
    },
  },
});

requestAnimationFrame(frame);
