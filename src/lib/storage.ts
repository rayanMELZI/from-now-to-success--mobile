import Storage from "expo-sqlite/kv-store";

/**
 * Synchronous key-value storage (SQLite under the hood). Synchronous is the
 * point: preferences, the theme and the last signed-in user are known on the
 * very first render, so the app never paints a default and then jumps.
 *
 * Everything kept here is a convenience (a remembered tab, the cached
 * screens), never the only copy of anything, so a failed read is just
 * "nothing stored".
 */
export function loadJson<T>(key: string): T | null {
  try {
    const raw = Storage.getItemSync(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) Storage.removeItemSync(key);
    else Storage.setItemSync(key, JSON.stringify(value));
  } catch {
    /* full or unavailable — the app works without it */
  }
}

/** Raw string access, for the query cache persister. */
export const rawStorage = {
  getItem: (key: string): string | null => {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      Storage.setItemSync(key, value);
    } catch {
      /* see saveJson */
    }
  },
  removeItem: (key: string): void => {
    try {
      Storage.removeItemSync(key);
    } catch {
      /* nothing to remove */
    }
  },
};
