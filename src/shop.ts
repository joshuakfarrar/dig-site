/**
 * The one purchase: everything unlocked, for good. The first `FREE_LOTS` lots are free to build;
 * after that the rest wait behind a parent gate (see `grownups.ts`).
 *
 * There's no store yet: Google Play Billing, Apple StoreKit and Amazon's in-app purchasing each need
 * a small native plugin, which comes with the store accounts. Until then:
 * - the paywall is off unless asked for, so nothing is locked in a build that can't sell anything
 *   (turn it on with `VITE_PAYWALL=on` at build time, or `?paywall` on the dev server);
 * - on the dev server, buying just unlocks, so the whole flow can be tried;
 * - in a release build, buying and restoring say the store isn't available.
 *
 * Owning it is remembered on this device only, like the town. Nothing is sent anywhere.
 */
const KEY = "dig-site/unlocked/v1";

/** How many lots are free, in all, before the rest are locked. */
export const FREE_LOTS = 2;

const devPaywall = import.meta.env.DEV && new URLSearchParams(location.search).has("paywall");

/** Whether anything is ever locked in this build. */
export function paywallOn(): boolean {
  return import.meta.env.VITE_PAYWALL === "on" || devPaywall;
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

/** True once `builtSoFar` lots are built and the rest need the unlock. */
export function locked(builtSoFar: number): boolean {
  return paywallOn() && !owned() && builtSoFar >= FREE_LOTS;
}

/** The store's price for it, in the buyer's currency, or null if the store can't say. */
export async function price(): Promise<string | null> {
  return import.meta.env.DEV ? "$2.99" : null;
}

export type Outcome = "bought" | "cancelled" | "unavailable";

export async function buy(): Promise<Outcome> {
  if (import.meta.env.DEV) {
    remember(true);
    return "bought";
  }
  return "unavailable";
}

/** Looks the purchase up with the store (a new device, or reinstalled): true if it's owned. */
export async function restore(): Promise<Outcome> {
  if (import.meta.env.DEV) return owned() ? "bought" : "cancelled";
  return "unavailable";
}

/** Dev only: forget the purchase, to try the free tier again. */
export function forget(): void {
  if (import.meta.env.DEV) remember(false);
}
