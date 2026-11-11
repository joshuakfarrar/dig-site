import * as Audio from "./audio";
import { touchIconURL } from "./guide";

/**
 * Touch controls, for tablets and phones. A thumb anywhere on the left half of the screen is a
 * stick: it rests in the corner and jumps to under the thumb, steering like a pad's stick. On the
 * right half, a big orange Work button that pops up when there's work to do (any tap on that side
 * that isn't the Hop button counts, so small hands can't miss), and a blue Hop button that's only
 * there when there's a machine to hop into. A phone or tablet has them up from the start (see
 * `input.ts`); a mouse never brings them up.
 */
export interface TouchFrame {
  moveX: number;
  moveY: number;
  work: boolean;
  workPressed: boolean;
  hopPressed: boolean;
}

const RADIUS = 56; // px from the stick's middle to full speed
const DEAD = 8; // px

const root = document.createElement("div");
root.id = "touch";
root.innerHTML = `
  <div id="stick"><div id="knob"></div></div>
  <button id="tapHop" class="tap" aria-label="Hop"></button>
  <button id="tapWork" class="tap" aria-label="Work"></button>`;
document.body.appendChild(root);
const stick = root.querySelector<HTMLDivElement>("#stick")!;
const knob = root.querySelector<HTMLDivElement>("#knob")!;
const hopBtn = root.querySelector<HTMLButtonElement>("#tapHop")!;
const workBtn = root.querySelector<HTMLButtonElement>("#tapWork")!;
workBtn.style.backgroundImage = `url(${touchIconURL("work")})`;
hopBtn.style.backgroundImage = `url(${touchIconURL("hop")})`;

let stickId: number | null = null;
let origin = { x: 0, y: 0 };
let vec = { x: 0, y: 0 };
const workIds = new Set<number>();
let workPressed = false;
let hopPressed = false;
let hopShown = false;
let onTouch: (() => void) | null = null;

/** Called the first time (and every time) the screen's touched, so prompts can switch to these pictures. */
export function onTouched(f: () => void): void {
  onTouch = f;
}

const isTouch = (e: PointerEvent) => e.pointerType === "touch" || e.pointerType === "pen";
/** The corner buttons and anything else clickable keep their own taps. */
const onOtherButton = (e: PointerEvent) => {
  const t = e.target as Element | null;
  return !!t?.closest("button") && !t.closest(".tap");
};

function placeStick(x: number, y: number): void {
  stick.style.left = `${x}px`;
  stick.style.top = `${y}px`;
  stick.classList.add("live");
}

function restStick(): void {
  stick.style.left = "";
  stick.style.top = "";
  stick.classList.remove("live");
  knob.style.transform = "";
}

addEventListener("pointerdown", (e) => {
  if (!isTouch(e) || onOtherButton(e)) return;
  onTouch?.();
  e.preventDefault();
  if (e.target === hopBtn) {
    if (hopShown) hopPressed = true;
    hopBtn.classList.add("down");
    return;
  }
  if (e.clientX < innerWidth * 0.5 && stickId === null) {
    stickId = e.pointerId;
    origin = { x: e.clientX, y: e.clientY };
    vec = { x: 0, y: 0 };
    placeStick(e.clientX, e.clientY);
    return;
  }
  if (e.clientX >= innerWidth * 0.5) {
    workIds.add(e.pointerId);
    workPressed = true;
    workBtn.classList.add("down");
  }
}, { passive: false });

addEventListener("pointermove", (e) => {
  if (e.pointerId !== stickId) return;
  let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
  const d = Math.hypot(dx, dy);
  // Drag past the edge and the stick follows the thumb, so it never runs out of room.
  if (d > RADIUS * 1.4) {
    const k = (d - RADIUS * 1.4) / d;
    origin.x += dx * k;
    origin.y += dy * k;
    placeStick(origin.x, origin.y);
    dx = e.clientX - origin.x;
    dy = e.clientY - origin.y;
  }
  const m = Math.hypot(dx, dy);
  const s = m < DEAD ? 0 : Math.min(1, (m - DEAD) / (RADIUS - DEAD)) / m;
  vec = { x: dx * s, y: dy * s };
  const kx = Math.min(m, RADIUS) / Math.max(m, 1e-6);
  knob.style.transform = `translate(${dx * kx}px, ${dy * kx}px)`;
});

function release(e: PointerEvent): void {
  if (e.pointerId === stickId) {
    stickId = null;
    vec = { x: 0, y: 0 };
    restStick();
  }
  if (workIds.delete(e.pointerId) && workIds.size === 0) workBtn.classList.remove("down");
  hopBtn.classList.remove("down");
}
addEventListener("pointerup", release);
addEventListener("pointercancel", release);
addEventListener("blur", () => {
  stickId = null;
  vec = { x: 0, y: 0 };
  workIds.clear();
  restStick();
  workBtn.classList.remove("down");
});
// No long-press menus or text selection under small thumbs.
addEventListener("contextmenu", (e) => e.preventDefault());

/** Shows or hides the touch controls (they're up while touch is what's being used). */
export function show(on: boolean): void {
  document.body.classList.toggle("touch", on);
}

const LINGER = 600; // ms Work stays up after the job's out of reach, so it doesn't flicker at the edge
let workUntil = 0;
let workShown = false;
let workGone = 0;

/**
 * What the game can do right now. Work and Hop are only on screen when pressing them would do
 * something: a button turning up means "press me". Work never goes from under a thumb that's on it,
 * and stays a moment after the job's out of reach, so it doesn't flicker as the truck edges about.
 */
export function hints(work: boolean, hop: boolean): void {
  const now = performance.now();
  if (work) workUntil = now + LINGER;
  const show = work || now < workUntil || (workShown && workIds.size > 0);
  if (show !== workShown) {
    workShown = show;
    workBtn.classList.toggle("ready", show);
    // A little sound as it pops up, unless it was only gone a moment (the crane stopping and
    // starting between pieces shouldn't ping every time).
    if (show && now - workGone > 1500 && document.body.classList.contains("touch")) Audio.ready();
    if (!show) workGone = now;
  }
  if (hop !== hopShown) {
    hopShown = hop;
    hopBtn.classList.toggle("shown", hop);
  }
}

export function read(): TouchFrame {
  const f = { moveX: vec.x, moveY: -vec.y, work: workIds.size > 0, workPressed, hopPressed };
  workPressed = false;
  hopPressed = false;
  return f;
}
