import { useCallback, useEffect, useState } from "react";
import { readJson, writeJson } from "./storage";

/**
 * useState that survives a restart — for preferences like "map or list", not
 * for data. The default shows until the saved value has been read back.
 */
export function usePersistentState<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    let alive = true;
    readJson<T>(`fnts.pref:${key}`).then((saved) => {
      if (alive && saved !== null) setValue(saved);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      void writeJson(`fnts.pref:${key}`, next);
    },
    [key],
  );

  return [value, set];
}
