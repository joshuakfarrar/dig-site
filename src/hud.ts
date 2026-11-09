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
  garden: `<svg viewBox="0 0 36 36"><rect x="5" y="22" width="26" height="9" fill="#cfd8e0"/><rect x="3" y="19" width="30" height="4" fill="#fff"/><rect x="6" y="15" width="24" height="4" fill="#7ec850"/><rect x="10" y="9" width="2" height="7" fill="#8a5a3c"/><circle cx="11" cy="8" r="5" fill="#3f9a45"/><rect x="20" y="12" width="7" height="3" fill="#9a6a3c"/></svg>`,
  cup: `<svg viewBox="0 0 36 36"><rect x="5" y="24" width="26" height="8" fill="#cfd8e0"/><rect x="3" y="21" width="30" height="4" fill="#fff"/><path d="M11 9h12v9a6 6 0 0 1-12 0z" fill="#ff5d8f"/><path d="M23 11h3a3 3 0 0 1 0 6h-3" fill="none" stroke="#ff5d8f" stroke-width="2"/><path d="M15 2c-2 2 2 3 0 5M19 2c-2 2 2 3 0 5" fill="none" stroke="#9aa3ad" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  book: `<svg viewBox="0 0 36 36"><rect x="5" y="24" width="26" height="8" fill="#cfd8e0"/><rect x="3" y="21" width="30" height="4" fill="#fff"/><path d="M18 19L5 15V7l13 4z" fill="#faf6ea" stroke="#7a4fd6" stroke-width="1.6"/><path d="M18 19l13-4V7l-13 4z" fill="#faf6ea" stroke="#7a4fd6" stroke-width="1.6"/></svg>`,
  lights: `<svg viewBox="0 0 36 36"><rect x="5" y="22" width="26" height="10" fill="#6f93cf"/><rect x="3" y="19" width="30" height="4" fill="#fff"/><rect x="8" y="13" width="7" height="5" rx="1" fill="#2f74d0"/><rect x="15" y="13" width="6" height="5" fill="#fff"/><rect x="21" y="13" width="7" height="5" rx="1" fill="#d8382c"/></svg>`,
  clock: `<svg viewBox="0 0 36 36"><path d="M2 22L18 12l16 10z" fill="#5b7db8"/><rect x="6" y="22" width="24" height="10" fill="#e6dccb"/><rect x="20" y="4" width="10" height="16" fill="#c0573f"/><circle cx="25" cy="11" r="3.4" fill="#fff"/><path d="M25 11l-1.6-1.4M25 11l2-1" stroke="#262626" stroke-width="1"/><path d="M19 4l6-4 6 4z" fill="#5b7db8"/></svg>`,
  lantern: `<svg viewBox="0 0 36 36"><rect x="12" y="20" width="12" height="13" fill="#d8382c"/><rect x="12" y="25" width="12" height="4" fill="#fff"/><rect x="10" y="17" width="16" height="3" fill="#3a3f47"/><rect x="13" y="9" width="10" height="8" fill="#9fd3ff"/><rect x="15" y="11" width="6" height="5" fill="#ffe066"/><path d="M11 9l7-6 7 6z" fill="#d8382c"/><path d="M24 12l10-4v8zM12 12L2 8v8z" fill="#fff4b0" opacity=".8"/></svg>`,
  fish: `<svg viewBox="0 0 36 36"><rect x="5" y="24" width="26" height="8" fill="#cfd8e0"/><rect x="3" y="21" width="30" height="4" fill="#fff"/><ellipse cx="20" cy="11" rx="10" ry="6" fill="#ff8a1f"/><path d="M10 11l-7-5v10z" fill="#ffc93c"/><circle cx="25" cy="9.5" r="1.6" fill="#fff"/><circle cx="25.4" cy="9.6" r=".8" fill="#262626"/></svg>`,
  whale: `<svg viewBox="0 0 36 36"><rect x="5" y="25" width="26" height="7" fill="#cfd8e0"/><rect x="3" y="22" width="30" height="4" fill="#fff"/><path d="M8 18c0-6 6-9 13-9s11 4 11 8-4 5-12 5-12-1-12-4z" fill="#3f7fd8"/><path d="M9 16L3 9l1 9z" fill="#3f7fd8"/><circle cx="27" cy="14" r="1.2" fill="#fff"/><path d="M21 8c-1-3 1-5 0-7M23 8c1-2 3-2 3-4" fill="none" stroke="#9fe3ff" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  haul: `<svg viewBox="0 0 36 36"><rect x="20" y="4" width="13" height="12" fill="#e8b84a"/><path d="M20 6h13v10H20z" fill="none" stroke="#c99a2e" stroke-width="1.4"/><path d="M3 12l14-4 2 12H4z" fill="#1fb5a8"/><path d="M6 10c2-3 6-4 9-3l1 5-10 1z" fill="#8c6239"/><rect x="18" y="14" width="9" height="8" fill="#1fb5a8"/><rect x="22" y="15" width="4" height="3" fill="#9fd3ff"/><rect x="3" y="20" width="25" height="3" fill="#3a3f47"/><circle cx="8" cy="25" r="3.4" fill="#262626"/><circle cx="23" cy="25" r="3.4" fill="#262626"/></svg>`,
  sweep: `<svg viewBox="0 0 36 36"><path d="M3 30c4-3 8-4 12-3" fill="none" stroke="#dcbd84" stroke-width="3" stroke-linecap="round"/><rect x="6" y="12" width="9" height="8" fill="#fff"/><rect x="6" y="15" width="9" height="2" fill="#4aa8ff"/><rect x="15" y="9" width="10" height="11" fill="#ff6fae"/><rect x="18" y="11" width="6" height="5" fill="#9fd3ff"/><rect x="5" y="19" width="22" height="4" fill="#ff6fae"/><circle cx="10" cy="25" r="3" fill="#262626"/><circle cx="22" cy="25" r="3" fill="#262626"/><ellipse cx="30" cy="25" rx="4" ry="1.8" fill="#f2c200"/><path d="M27 21l3 3" stroke="#3a3f47" stroke-width="1.4"/></svg>`,
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

// ------------------------------------------------------------------ choosing by picture

/**
 * A row of big pictures to pick from (the paint for a home, its roof), over the middle of the
 * screen. Left and right move the highlight and Work picks it; or tap or click one. Nothing to read.
 */
const picker = document.createElement("div");
picker.id = "picker";
document.body.appendChild(picker);
let picked: ((i: number) => void) | null = null;
let sel = 0;
let count = 0;
let owner = 0; // which `choose` the pictures up now belong to

function highlight(): void {
  picker.querySelectorAll<HTMLButtonElement>(".swatch").forEach((b, i) => b.classList.toggle("sel", i === sel));
}

/** Puts the pictures up; returns a ticket that `cancelChoice` takes, so only the asker can take them down. */
export function choose(pictures: string[], onPick: (i: number) => void): number {
  picked = onPick;
  owner++;
  sel = 0;
  count = pictures.length;
  picker.innerHTML = `<div class="row">${pictures.map((p, i) => `<button class="swatch" data-i="${i}" aria-label="Choice ${i + 1}">${p}</button>`).join("")}</div>`;
  picker.querySelectorAll<HTMLButtonElement>(".swatch").forEach((b) =>
    b.addEventListener("click", () => {
      sel = Number(b.dataset.i);
      confirmChoice();
    }),
  );
  highlight();
  picker.classList.add("on");
  return owner;
}

export function choosing(): boolean {
  return picked !== null;
}

export function moveChoice(d: number): void {
  if (!picked) return;
  sel = (sel + d + count) % count;
  highlight();
}

export function confirmChoice(): void {
  const f = picked;
  if (!f) return;
  picked = null;
  picker.classList.remove("on");
  f(sel);
}

/** Closes the pictures without picking (leaving the site while they're up), if they're still `ticket`'s. */
export function cancelChoice(ticket: number): void {
  if (ticket !== owner) return;
  picked = null;
  picker.classList.remove("on");
}
