import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * The one purchase: everything unlocked, for good. The first `FREE_LOTS` lots are free to build;
 * after that the rest wait behind a parent gate (see `grownups.ts`).
 *
 * The store is the app's own `Store` plugin: on Android `StorePlugin.java`, with Google Play's or
 * Amazon's backend in each store's build; on iOS `StorePlugin.swift` (StoreKit 2). Nothing is locked
 * unless this build can actually sell the unlock, so a build without a working store (the web page,
 * a Play build on a device without Google Play, an Amazon build without its key) is simply the
 * whole game.
 *
 * On the dev server, `?paywall` turns the padlocks on and buying just unlocks, so the whole flow can
 * be tried in a browser.
 *
 * Owning it is remembered on this device only, like the town, and checked with the store quietly
 * at every start: a purchase made on another device, or a pending payment that's cleared, unlocks
 * it. It's taken back only when the store says outright that it was refunded ("revoked": Apple and
 * Amazon say so; Google Play never does, since a purchase missing there could just mean another
 * account on a family tablet). Never because the store couldn't be reached or found nothing.
 * Nothing about the family is sent anywhere.
 */
const KEY = "dig-site/unlocked/v1";

/** The product's id in every store (Google Play, Amazon, the App Store). */
export const PRODUCT = "full_game";

/** How many lots are free, in all, before the rest are locked. */
export const FREE_LOTS = 2;

type Answer = "bought" | "pending" | "cancelled" | "none" | "revoked" | "failed" | "unavailable";
interface StorePlugin {
  sells(): Promise<{ sells: boolean }>;
  price(o: { id: string }): Promise<{ price?: string }>;
  buy(o: { id: string }): Promise<{ outcome: Answer }>;
  restore(o: { id: string; quiet?: boolean }): Promise<{ outcome: Answer }>;
  addListener(event: "owned" | "revoked", f: (e: { id: string }) => void): Promise<unknown>;
}
const Store = registerPlugin<StorePlugin>("Store");
const native = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Store");

const devPaywall = import.meta.env.DEV && new URLSearchParams(location.search).has("paywall");
let sells = false; // this build's store can sell (asked once, at start)

/** Whether anything is locked in this build: only if the unlock can actually be bought here. */
export function paywallOn(): boolean {
  return devPaywall || sells;
}

let ownedNow: boolean | null = null; // read once, then kept here (it's asked every frame)

export function owned(): boolean {
  if (ownedNow === null) {
    try {
      ownedNow = localStorage.getItem(KEY) === "yes";
    } catch {
      ownedNow = false;
    }
  }
  return ownedNow;
}

function remember(on: boolean): void {
  ownedNow = on;
  try {
    if (on) localStorage.setItem(KEY, "yes");
    else localStorage.removeItem(KEY);
  } catch {
    // Not kept: they'd restore it next time.
  }
}

/** What a store's answer means for what the device remembers: only "bought" and "revoked" change it. */
const arrived = new Set<() => void>();

/**
 * Runs `f` when the unlock arrives from the store on its own, not from a Buy or Restore press: an
 * approved Ask to Buy, or a payment that's cleared. (The grown-ups' card closes if it's still up.)
 */
export function onArrived(f: () => void): void {
  arrived.add(f);
}

function heed(a: Answer): void {
  if (a === "bought") remember(true);
  else if (a === "revoked") remember(false);
}

// At start: can this build sell, and what does the store say now? (Quietly: no sheet, no sign-in.)
if (native) {
  void Store.addListener("owned", (e) => {
    if (e.id !== PRODUCT) return;
    const was = owned();
    heed("bought");
    if (!was) arrived.forEach((f) => f());
  });
  void Store.addListener("revoked", (e) => e.id === PRODUCT && heed("revoked"));
  void Store.sells()
    .then((r) => {
      sells = r.sells;
      if (sells) return Store.restore({ id: PRODUCT, quiet: true }).then((a) => heed(a.outcome));
    })
    .catch(() => {});
}

/** True once `builtSoFar` lots are built and the rest need the unlock. */
export function locked(builtSoFar: number): boolean {
  return paywallOn() && !owned() && builtSoFar >= FREE_LOTS;
}

/** The store's price for it, in the buyer's currency, or null if the store can't say. */
export async function price(): Promise<string | null> {
  if (native) return Store.price({ id: PRODUCT }).then((r) => r.price ?? null).catch(() => null);
  return import.meta.env.DEV ? "$2.99" : null;
}

/** How a purchase or restore went, as the grown-ups' card tells it. */
export type Outcome = Answer;

async function ask(f: () => Promise<{ outcome: Answer }>): Promise<Outcome> {
  try {
    const { outcome } = await f();
    heed(outcome);
    return outcome;
  } catch {
    return "failed";
  }
}

export async function buy(): Promise<Outcome> {
  if (native) return ask(() => Store.buy({ id: PRODUCT }));
  if (import.meta.env.DEV) {
    remember(true);
    return "bought";
  }
  return "unavailable";
}

/** Looks the purchase up with the store (a new device, or reinstalled). */
export async function restore(): Promise<Outcome> {
  if (native) return ask(() => Store.restore({ id: PRODUCT }));
  if (import.meta.env.DEV) return owned() ? "bought" : "none";
  return "unavailable";
}

/** Dev only: forget the purchase, to try the free tier again. */
export function forget(): void {
  if (import.meta.env.DEV) remember(false);
}
