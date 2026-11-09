/**
 * The town is kept between visits in this browser's local storage, and nowhere else: which lots
 * are built in each neighbourhood, and which neighbourhood you were last in. Nothing's sent
 * anywhere. If storage isn't there (a private window), it just isn't kept.
 */
const KEY = "dig-site/town/v2";
const OLD_KEY = "dig-site/town/v1"; // one neighbourhood only: its lots become the first's

export interface Town {
  built: number[][]; // per neighbourhood, lot indices in the order they were built
  at: number; // the neighbourhood you were last in
  looks: Record<string, [number, number]>; // "hood:lot": the wall and roof colours picked for it
}

const lots = (a: unknown): number[] =>
  Array.isArray(a) ? [...new Set(a.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 64))] : [];

export function fresh(): Town {
  return { built: [[]], at: 0, looks: {} };
}

export function load(): Town {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const t = JSON.parse(raw) as Partial<Town>;
      const built = Array.isArray(t.built) ? t.built.slice(0, 16).map(lots) : [[]];
      const at = Number.isInteger(t.at) && (t.at as number) >= 0 && (t.at as number) < built.length ? (t.at as number) : 0;
      const looks: Record<string, [number, number]> = {};
      if (t.looks && typeof t.looks === "object")
        for (const [k, v] of Object.entries(t.looks))
          if (/^\d+:\d+$/.test(k) && Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n >= 0 && n < 8))
            looks[k] = [v[0], v[1]];
      return { built: built.length ? built : [[]], at, looks };
    }
    const old = localStorage.getItem(OLD_KEY);
    if (old) return { built: [lots((JSON.parse(old) as { built?: unknown }).built)], at: 0, looks: {} };
  } catch {
    // Unreadable: start fresh.
  }
  return fresh();
}

export function save(t: Town): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
    localStorage.removeItem(OLD_KEY);
  } catch {
    // Not kept: fine.
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The lots built so far in neighbourhood `h`. */
export function builtIn(t: Town, h: number): number[] {
  while (t.built.length <= h) t.built.push([]);
  return t.built[h];
}
