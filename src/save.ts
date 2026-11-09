/**
 * The town is kept between visits in this browser's local storage, and nowhere else: which lots
 * are built. Nothing's sent anywhere. If storage isn't there (a private window), it just isn't kept.
 */
const KEY = "dig-site/town/v1";

export interface Town {
  built: number[]; // lot indices, in the order they were built
}

export function load(): Town {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { built: [] };
    const t = JSON.parse(raw) as Partial<Town>;
    const built = Array.isArray(t.built) ? t.built.filter((n) => Number.isInteger(n) && n >= 0 && n < 64) : [];
    return { built: [...new Set(built)] };
  } catch {
    return { built: [] };
  }
}

export function save(t: Town): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // Not kept: fine.
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
