import * as THREE from "three";

/**
 * How hard the game works the graphics, so a cheap tablet stays smooth. It starts from a guess
 * (a phone or tablet with few cores or little memory starts low) and steps down a level if frames
 * keep coming slowly; it never steps back up, so it can't flicker between the two. The level it
 * settles on is remembered on this device. `?quality=high|medium|low` forces one, for testing.
 */
export type Tier = "high" | "medium" | "low";
const ORDER: Tier[] = ["high", "medium", "low"];
const KEY = "dig-site/quality/v1";

interface Settings {
  pixelRatio: number; // the most device pixels per CSS pixel
  shadowSize: number;
  antialias: boolean;
}
const SETTINGS: Record<Tier, Settings> = {
  high: { pixelRatio: 2, shadowSize: 2048, antialias: true },
  medium: { pixelRatio: 1.5, shadowSize: 1024, antialias: true },
  low: { pixelRatio: 1, shadowSize: 512, antialias: false },
};

function guess(): Tier {
  const forced = new URLSearchParams(location.search).get("quality") as Tier | null;
  if (forced && ORDER.includes(forced)) return forced;
  try {
    const kept = localStorage.getItem(KEY) as Tier | null;
    if (kept && ORDER.includes(kept)) return kept;
  } catch {
    // No storage: guess.
  }
  const touch = navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (touch && (cores <= 4 || memory <= 3)) return "low";
  if (touch) return "medium";
  return "high";
}

let tier: Tier = guess();
let renderer: THREE.WebGLRenderer | null = null;
let sun: THREE.DirectionalLight | null = null;

export function current(): Tier {
  return tier;
}
export function settings(): Settings {
  return SETTINGS[tier];
}

export function useRenderer(r: THREE.WebGLRenderer): void {
  renderer = r;
  r.setPixelRatio(Math.min(devicePixelRatio, settings().pixelRatio));
}

/** Each scene's sun takes the current shadow size, and follows it if the level drops. */
export function useSun(s: THREE.DirectionalLight): void {
  sun = s;
  s.shadow.mapSize.set(settings().shadowSize, settings().shadowSize);
}

function apply(): void {
  const st = settings();
  if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio, st.pixelRatio));
    renderer.setSize(innerWidth, innerHeight);
  }
  if (sun) {
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    sun.shadow.mapSize.set(st.shadowSize, st.shadowSize);
  }
  try {
    localStorage.setItem(KEY, tier);
  } catch {
    // Not kept: fine.
  }
}

// ------------------------------------------------------------------ watching the frame rate

const WINDOW = 3; // seconds of frames per check
const SLOW = 1 / 40; // slower than about 40 fps on average: step down
let warmup = 3; // seconds: loading hiccups don't count
let sum = 0;
let count = 0;

/**
 * Called every frame with the real time since the last one. Gaps over a tenth of a second are a
 * hidden tab or a hiccup, not a slow device, so they're left out.
 */
export function frame(dt: number): void {
  if (dt > 0.1 || document.visibilityState !== "visible") return;
  if (warmup > 0) {
    warmup -= dt;
    return;
  }
  sum += dt;
  count++;
  if (sum < WINDOW) return;
  const avg = sum / count;
  sum = 0;
  count = 0;
  const i = ORDER.indexOf(tier);
  if (avg > SLOW && i < ORDER.length - 1) {
    tier = ORDER[i + 1];
    apply();
    warmup = 1.5;
  }
}
