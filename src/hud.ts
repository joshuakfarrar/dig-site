/**
 * The bits drawn over the scene in HTML, all pictures and no words: the progress strip along the
 * top, the sound button, the hold-to-confirm corner button and the fade between town and site.
 */
const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");

export const Icons = {
  dig: `<svg viewBox="0 0 36 36"><path d="M3 12h7v12h16V12h7v4h-3v12H6V16H3z" fill="#8c6239"/><rect x="10" y="20" width="16" height="4" fill="#9b9184"/></svg>`,
  pour: `<svg viewBox="0 0 36 36"><rect x="4" y="20" width="28" height="7" rx="1" fill="#9aa0a6"/><rect x="4" y="20" width="28" height="2" fill="#c9cbcc"/><path d="M15 4h6l-1 12h-4z" fill="#f2c200"/><circle cx="18" cy="18" r="1.6" fill="#8f969c"/></svg>`,
  walls: (paint: number) =>
    `<svg viewBox="0 0 36 36"><rect x="4" y="27" width="28" height="3" fill="#9aa0a6"/><rect x="6" y="13" width="24" height="14" fill="${hex(paint)}"/><rect x="15" y="18" width="6" height="9" fill="#9a6a3c"/><rect x="8" y="16" width="5" height="5" fill="#fff"/><rect x="23" y="16" width="5" height="5" fill="#fff"/></svg>`,
  upstairs: (paint: number) =>
    `<svg viewBox="0 0 36 36"><rect x="4" y="31" width="28" height="3" fill="#9aa0a6"/><rect x="7" y="19" width="22" height="12" fill="${hex(paint)}" opacity=".55"/><rect x="7" y="5" width="22" height="13" fill="${hex(paint)}"/><rect x="7" y="17" width="22" height="2" fill="#fff"/><rect x="10" y="8" width="5" height="5" fill="#fff"/><rect x="21" y="8" width="5" height="5" fill="#fff"/></svg>`,
  roof: (tile: number) =>
    `<svg viewBox="0 0 36 36"><path d="M2 17L18 5l16 12z" fill="${hex(tile)}"/><rect x="6" y="17" width="24" height="12" fill="#cfd8e0"/><rect x="15" y="20" width="6" height="9" fill="#9a6a3c"/><rect x="24" y="7" width="4" height="6" fill="#a0522d"/></svg>`,
  cone: (scoop: number) =>
    `<svg viewBox="0 0 36 36"><rect x="5" y="22" width="26" height="9" fill="#cfd8e0"/><rect x="3" y="20" width="30" height="3" fill="#fff"/><path d="M14 18h8l-4 -8z" transform="rotate(180 18 14)" fill="#e0a85a"/><circle cx="18" cy="9" r="5" fill="${hex(scoop)}"/><circle cx="18" cy="3.5" r="1.6" fill="#d8263a"/></svg>`,
  tower: `<svg viewBox="0 0 36 36"><rect x="4" y="22" width="28" height="9" fill="#c0573f"/><rect x="3" y="20" width="30" height="3" fill="#fff"/><rect x="20" y="8" width="9" height="12" fill="#c0573f"/><path d="M19 9l5.5-5 5.5 5z" fill="#4a4f57"/><rect x="23" y="11" width="3" height="3" fill="#f2c200"/></svg>`,
  path: `<svg viewBox="0 0 36 36"><path d="M12 34l3-20h6l3 20z" fill="#c3c7cc"/><path d="M13.2 26h9.6M14.4 19h7.2" stroke="#8d939a" stroke-width="1.2"/><rect x="7" y="4" width="22" height="10" rx="5" fill="#7d8590"/><rect x="9" y="6" width="18" height="2" fill="#8a8f96"/><rect x="16" y="1" width="4" height="4" fill="#2ea05a"/></svg>`,
  clean: `<svg viewBox="0 0 36 36"><path d="M22 27c0-5 4-8 9-8v8z" fill="#8c6239" opacity=".5"/><rect x="4" y="18" width="14" height="8" rx="2" fill="#8a5cd6"/><rect x="7" y="11" width="7" height="7" fill="#8a5cd6"/><rect x="8" y="12" width="5" height="3" fill="#9fd3ff"/><rect x="3" y="26" width="16" height="4" rx="2" fill="#262626"/><path d="M19 15h3v15h-3z" fill="#8a5cd6"/><rect x="19" y="13" width="3" height="2" fill="#f2c200"/><path d="M26 10l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#ffc93c"/></svg>`,
  house: (paint: number, built: boolean) =>
    built
      ? `<svg viewBox="0 0 36 36"><path d="M4 17L18 6l14 11z" fill="#d2513a"/><rect x="8" y="17" width="20" height="13" fill="${hex(paint)}"/><rect x="15" y="21" width="6" height="9" fill="#9a6a3c"/></svg>`
      : `<svg viewBox="0 0 36 36"><path d="M4 17L18 6l14 11z" fill="none" stroke="#a9b2bb" stroke-width="2" stroke-dasharray="3 2.4" stroke-linejoin="round"/><rect x="8" y="17" width="20" height="13" fill="none" stroke="#a9b2bb" stroke-width="2" stroke-dasharray="3 2.4"/></svg>`,
};

export interface Step {
  icon: string;
  state: "todo" | "now" | "done";
}

const progress = document.getElementById("progress")!;
let lastKey = "";

/** Shows the steps; only touches the page when they change. */
export function steps(list: Step[], small = false): void {
  const key = list.map((s) => s.state + s.icon).join("|") + small;
  if (key === lastKey) return;
  lastKey = key;
  progress.classList.toggle("small", small);
  progress.innerHTML = list.map((s) => `<div class="step ${s.state === "todo" ? "" : s.state}">${s.icon}</div>`).join("");
}

// ------------------------------------------------------------------ hold-to-confirm corner button

/**
 * The corner button that throws progress away (back to town from a site, or a new town) has to be
 * held, with a ring filling round it, so a stray tap or bump never undoes a child's work.
 */
const hold = document.getElementById("hold") as HTMLButtonElement;
// Back to town from a site loses that site's work: a short hold. A new town loses everything: longer.
const HOLD_SECONDS = { home: 1.2, fresh: 2.4 };
let holdKind: "home" | "fresh" | null = null;
let held = 0;
let pointerHeld = false;
let needRelease = false; // once it's gone off, it waits to be let go before it can again
let onConfirm: (() => void) | null = null;

hold.addEventListener("pointerdown", (e) => {
  pointerHeld = true;
  hold.setPointerCapture(e.pointerId);
});
for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) hold.addEventListener(ev, () => (pointerHeld = false));
hold.addEventListener("contextmenu", (e) => e.preventDefault());

export function corner(kind: "home" | "fresh" | null, confirm: (() => void) | null): void {
  holdKind = kind;
  onConfirm = confirm;
  hold.hidden = kind === null;
  hold.dataset.kind = kind ?? "";
  held = 0;
  hold.style.setProperty("--p", "0");
}

/** `keyHeld`: the keyboard's or pad's restart button is down this frame. */
export function updateHold(dt: number, keyHeld: boolean): void {
  if (!holdKind) return;
  let down = pointerHeld || keyHeld;
  if (!down) needRelease = false;
  if (needRelease) down = false;
  held = down ? held + dt : Math.max(0, held - dt * 3);
  const need = HOLD_SECONDS[holdKind];
  hold.style.setProperty("--p", String(Math.min(1, held / need)));
  hold.classList.toggle("holding", down);
  if (held >= need) {
    held = 0;
    pointerHeld = false;
    needRelease = true;
    const f = onConfirm;
    f?.();
  }
}

/** Pulses the corner button (the town's all built: here's how to start another). */
export function nudge(on: boolean): void {
  hold.classList.toggle("nudge", on);
}

// ------------------------------------------------------------------ fade

const fadeEl = document.getElementById("fade")!;
export function fade(on: boolean): Promise<void> {
  fadeEl.classList.toggle("on", on);
  return new Promise((r) => setTimeout(r, 380));
}
