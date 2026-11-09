import * as THREE from "three";
import * as Audio from "./audio";
import * as Hud from "./hud";
import * as Input from "./input";
import * as B from "./blueprints";
import * as Save from "./save";
import * as Quality from "./quality";
import { createBuild, STAGES, type BuildMode, type Stage } from "./build";
import { createTown, type TownMode } from "./town";
import { fitCamera, setViewZoom, type Mode } from "./stage";

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
addEventListener("resize", () => fit(mode));

function use(m: Mode): void {
  const old = mode;
  mode = m;
  fit(m);
  if (old && old !== m) old.dispose();
}

function goTown(arrived: number | null): void {
  build = null;
  town = createTown(new Set(saved.built), arrived, {
    build: (i) => void switchTo(() => goBuild(i)),
    controls: Input.controls,
    hints: Input.hints,
  });
  use(town);
  Hud.corner("fresh", () =>
    void switchTo(() => {
      Save.clear();
      saved = { built: [] };
      goTown(null);
    }),
  );
}

function goBuild(i: number, at?: Stage): void {
  town = null;
  Hud.nudge(false);
  build = createBuild(B.LOTS[i], {
    finished: () =>
      void switchTo(() => {
        if (!saved.built.includes(i)) saved.built.push(i);
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
  if (read.workPressed || read.hopPressed || read.moveX || read.moveY) Audio.unlock();
  const input = switching ? idle : read;
  mode.tick(dt, input);
  Hud.updateHold(dt, input.restart);
}

let last = performance.now();
let paused = false;
function frame(now: number): void {
  const real = (now - last) / 1000;
  const dt = Math.min(0.05, real);
  last = now;
  if (!paused) {
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

document.getElementById("mute")!.addEventListener("click", (e) => {
  Audio.unlock();
  (e.currentTarget as HTMLElement).classList.toggle("off", Audio.toggleMute());
});
addEventListener("pointerdown", () => Audio.unlock());

// Dev aids: `?lot=3` goes straight to that lot's site, `&stage=walls` further on into it.
const params = new URLSearchParams(location.search);
const lotParam = params.get("lot");
const stageParam = params.get("stage") as Stage | null;
if (lotParam !== null && B.LOTS[Number(lotParam)]) goBuild(Number(lotParam), stageParam && STAGES.includes(stageParam) ? stageParam : undefined);
else goTown(null);

// For poking at it from the console (and for checking renders); not in the released game.
if (import.meta.env.DEV) Object.assign(window, {
  game: {
    get mode() { return mode; },
    get town() { return town?.debug; },
    get build() { return build?.debug; },
    renderer,
    goTown,
    goBuild,
    /** Steps the game `seconds` at 60 Hz with this input held, then draws (a hidden tab's frames are throttled). */
    advance(seconds: number, held: Partial<Input.Frame> = {}) {
      const steps = Math.round(seconds * 60);
      for (let i = 0; i < steps; i++) tick(1 / 60, { ...idle, ...held, ...(i > 0 ? { workPressed: false, hopPressed: false } : {}) });
      renderer.render(mode.scene, mode.camera);
    },
  },
});

requestAnimationFrame(frame);
