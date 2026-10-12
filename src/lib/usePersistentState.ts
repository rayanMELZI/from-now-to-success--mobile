import { useCallback, useState } from "react";
import { loadJson, saveJson } from "./storage";

/**
 * useState that survives a restart — for preferences like "map or list", not
 * for data. Storage is synchronous, so the saved value is there on the first
 * render.
 */
export function usePersistentState<T>(key: string, initial: T): [T, (next: T) => void] {
  const storageKey = `fnts.pref:${key}`;
  const [value, setValue] = useState<T>(() => loadJson<T>(storageKey) ?? initial);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      saveJson(storageKey, next);
    },
    [storageKey],
  );

  return [value, set];
}
