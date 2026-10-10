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
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [profile, setProfile] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((next: UserInfo | null) => {
    setUserState(next);
    if (next) setProfile(next);
  }, []);

  // On launch, restore the session from the refresh cookie.
  useEffect(() => {
    apiClient
      .tryRefresh()
      .then((restored) => {
        setUser(restored);
        void rememberUser(restored);
      })
      // No network: open on the last account this phone showed.
      .catch(async () => setUser(await recallUser()))
      .finally(() => setLoading(false));
  }, [setUser]);

  const login = useCallback(async (email: string, password: string) => {
    const loggedIn = await apiClient.login(email, password);
    setUser(loggedIn);
    void rememberUser(loggedIn);
  }, [setUser]);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      const registered = await apiClient.register(username, email, password);
      setUser(registered);
      void rememberUser(registered);
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    await apiClient.logout();
    await rememberUser(null);
    setUser(null);
  }, [setUser]);

  const refreshUser = useCallback(async () => {
    const fresh = await apiClient.api<UserInfo>("/api/users/me");
    setUser(fresh);
    void rememberUser(fresh);
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
