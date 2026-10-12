import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as apiClient from "./api";
import { recallUser, rememberUser } from "./offline";
import { prefetchEssentials } from "./queries";
import type { UserInfo } from "./types";

interface AuthState {
  user: UserInfo | null;
  /** The last signed-in profile — still set while signed-out screens unmount. */
  profile: UserInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Who is signed in. Navigation is not done here: the root layout guards its
 * screens on `user`, so setting it to null is all "log out" needs to do.
 *
 * Opening the app never waits on the network: whoever was signed in last is
 * shown straight away, with their cached screens, while the session is
 * refreshed in the background. Only a refresh the server actually refuses
 * signs them out — no signal is not a reason to.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(recallUser);
  const [user, setUserState] = useState<UserInfo | null>(stored);
  const [profile, setProfile] = useState<UserInfo | null>(stored);
  // Only a first launch (nobody remembered) has to wait for the answer.
  const [loading, setLoading] = useState(stored === null);

  const setUser = useCallback((next: UserInfo | null) => {
    setUserState(next);
    if (next) setProfile(next);
    rememberUser(next);
  }, []);

  useEffect(() => {
    if (stored) prefetchEssentials();
    apiClient
      .tryRefresh()
      .then(async (restored) => {
        if (restored) {
          setUser(restored);
        } else if (stored) {
          // The server refused the session: this account's cache must go too.
          await apiClient.clearCachedData();
          setUser(null);
        }
      })
      .catch(() => {
        /* offline: keep showing the remembered account */
      })
      .finally(() => setLoading(false));
  }, [stored, setUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      setUser(await apiClient.login(email, password));
      prefetchEssentials();
    },
    [setUser],
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      setUser(await apiClient.register(username, email, password));
      prefetchEssentials();
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    await apiClient.logout();
    setUser(null);
  }, [setUser]);

  const refreshUser = useCallback(async () => {
    setUser(await apiClient.api<UserInfo>("/api/users/me"));
  }, [setUser]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** For screens that only render once signed in. */
export function useUser(): UserInfo {
  const { profile } = useAuth();
  if (!profile) throw new Error("useUser called before anyone signed in");
  return profile;
}
