import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * AsyncStorage with the failure modes folded away: everything kept here is a
 * convenience (a remembered tab, a cached screen), never the only copy of
 * anything, so a read that fails is just "nothing stored".
 */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    if (value === null || value === undefined) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* full or unavailable — the app works without it */
  }
}

export async function removeByPrefix(prefix: string): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(prefix)));
  } catch {
    /* nothing to clear */
  }
}
