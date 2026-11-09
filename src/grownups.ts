import * as Shop from "./shop";

/**
 * The only words in the game, and only for grown-ups: a parent gate, then the unlock.
 *
 * The gate asks a sum written out in words ("What is seven plus six?") with a number pad to answer
 * on. A small child can't read it or do it; a grown-up does it in a moment. A wrong answer brings
 * a new sum, and three in a row closes it. Everything about buying sits behind it, as the
 * stores' kids' rules ask.
 */
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

const root = document.createElement("div");
root.id = "grownups";
root.setAttribute("role", "dialog");
root.setAttribute("aria-modal", "true");
document.body.appendChild(root);

let isOpen = false;
let onUnlocked: (() => void) | null = null;
let answer = 0;
let typed = "";
let misses = 0;

/** Whether the grown-ups' screens are up (the game ignores its controls meanwhile). */
export function open(): boolean {
  return isOpen;
}

/** Opens the gate; `unlocked` runs if they go on to buy or restore it. */
export function show(unlocked: () => void): void {
  onUnlocked = unlocked;
  isOpen = true;
  misses = 0;
  gate();
  root.classList.add("on");
}

export function close(): void {
  isOpen = false;
  root.classList.remove("on");
  root.innerHTML = "";
}

function closeButton(): string {
  return `<button class="gx" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="#3a3f47" stroke-width="2.6" stroke-linecap="round"/></svg></button>`;
}

function gate(): void {
  // Two numbers whose sum is 11 to 18, so the answer is always two digits.
  const a = 4 + Math.floor(Math.random() * 6); // 4 to 9
  const lo = 11 - a;
  const b = lo + Math.floor(Math.random() * (10 - lo)); // lo to 9
  answer = a + b;
  typed = "";
  root.innerHTML = `
    <div class="card">
      ${closeButton()}
      <h2>For grown-ups</h2>
      <p>What is ${WORDS[a]} plus ${WORDS[b]}?</p>
      <div class="typed" aria-live="polite"></div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => `<button data-n="${n}">${n}</button>`).join("")}</div>
    </div>`;
  root.querySelector(".gx")!.addEventListener("click", close);
  root.querySelectorAll<HTMLButtonElement>(".pad button").forEach((btn) => btn.addEventListener("click", () => digit(Number(btn.dataset.n))));
  showTyped();
}

function showTyped(): void {
  const t = root.querySelector(".typed");
  if (t) t.textContent = typed.padEnd(2, "_").split("").join(" ");
}

function digit(n: number): void {
  if (!isOpen || !root.querySelector(".pad")) return;
  typed += String(n);
  showTyped();
  if (typed.length < 2) return;
  if (Number(typed) === answer) {
    sheet();
    return;
  }
  misses++;
  if (misses >= 3) {
    close();
    return;
  }
  const card = root.querySelector(".card")!;
  card.classList.remove("shake");
  void (card as HTMLElement).offsetWidth;
  card.classList.add("shake");
  setTimeout(gate, 450);
}

addEventListener("keydown", (e) => {
  if (!isOpen) return;
  if (e.key === "Escape") close();
  else if (/^[0-9]$/.test(e.key)) digit(Number(e.key));
  else if (e.key === "Backspace" && typed) {
    typed = typed.slice(0, -1);
    showTyped();
  }
});

function sheet(): void {
  root.innerHTML = `
    <div class="card wide">
      ${closeButton()}
      <h2>Unlock all of Dig Site</h2>
      <p>The first ${Shop.FREE_LOTS} lots are free. One purchase unlocks every lot on every street (Home Street, Market Square and the Harbour), and every neighbourhood added later.</p>
      <p class="small">No ads, no subscriptions, nothing to sign up for, and nothing about your family is collected or sent anywhere.</p>
      <div class="actions">
        <button class="buy">Unlock</button>
        <button class="restore">Restore purchase</button>
      </div>
      <p class="status" aria-live="polite"></p>
    </div>`;
  root.querySelector(".gx")!.addEventListener("click", close);
  const buyBtn = root.querySelector<HTMLButtonElement>(".buy")!;
  const restoreBtn = root.querySelector<HTMLButtonElement>(".restore")!;
  const status = root.querySelector<HTMLElement>(".status")!;
  void Shop.price().then((p) => {
    if (p && buyBtn.isConnected) buyBtn.textContent = `Unlock for ${p}`;
  });
  const busy = (on: boolean) => {
    buyBtn.disabled = restoreBtn.disabled = on;
  };
  const settle = (o: Shop.Outcome, restoring: boolean) => {
    busy(false);
    if (o === "bought") {
      const f = onUnlocked;
      close();
      f?.();
    } else if (o === "unavailable") status.textContent = "The store isn't available in this version yet.";
    else status.textContent = restoring ? "No purchase found for this account." : "";
  };
  buyBtn.addEventListener("click", () => {
    busy(true);
    status.textContent = "";
    void Shop.buy().then((o) => settle(o, false));
  });
  restoreBtn.addEventListener("click", () => {
    busy(true);
    status.textContent = "";
    void Shop.restore().then((o) => settle(o, true));
  });
}
