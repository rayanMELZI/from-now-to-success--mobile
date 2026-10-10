import { API_URL } from "./config";
import { reportReachable, reportUnreachable } from "./offline";
import { readJson, removeByPrefix, writeJson } from "./storage";
import type { UserInfo } from "./types";

/**
 * The access token lives only in memory. The refresh token is the backend's
 * httpOnly `fnts_refresh` cookie, which the native networking layer (OkHttp on
 * Android, NSURLSession on iOS) stores and replays on its own — exactly the way
 * a browser does for the web app, so the backend needs no mobile-specific auth.
 */
let accessToken: string | null = null;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Status 0 means the request never reached the server at all. */
export function isOfflineError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface AuthPayload {
  accessToken: string;
  user: UserInfo;
}

const TIMEOUT_MS = 15_000;

/** One door for every request, so connectivity has a single source of truth. */
async function send(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL + path, {
      ...init,
      credentials: "include",
      signal: controller.signal,
    });
    reportReachable();
    return res;
  } catch {
    reportUnreachable();
    throw new ApiError(0, "You're offline — this didn't reach the server.");
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------ offline cache */

/**
 * Every successful GET is kept, so the app still opens on its last known
 * state with no signal — the job the service worker does for the web app.
 * Writes are never queued: they need the server to be honest about points.
 */
const CACHE_PREFIX = "fnts.cache:";

export const clearCachedData = () => removeByPrefix(CACHE_PREFIX);

/* ------------------------------------------------------------------ refresh */

/**
 * One refresh at a time. Refresh tokens rotate, so two parallel refreshes
 * would present a just-revoked token, which the server reads as a replayed
 * stolen token and answers by revoking every session of the account.
 */
let refreshing: Promise<UserInfo | null> | null = null;

export function tryRefresh(): Promise<UserInfo | null> {
  refreshing ??= runRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function runRefresh(): Promise<UserInfo | null> {
  const res = await send("/api/auth/refresh", { method: "POST" });
  if (!res.ok) return null;
  const data: AuthPayload = await res.json();
  accessToken = data.accessToken;
  return data.user;
}

/* ------------------------------------------------------------------ the call */

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const doFetch = () =>
    send(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  const tokenUsed = accessToken;
  let res: Response;
  try {
    res = await doFetch();
  } catch (err) {
    if (method === "GET" && isOfflineError(err)) {
      const cached = await readJson<T>(CACHE_PREFIX + path);
      if (cached !== null) return cached;
    }
    throw err;
  }

  // Expired access token: refresh once and retry — unless a parallel request
  // already swapped the token in, in which case retrying with it is enough.
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    if (accessToken !== tokenUsed) {
      res = await doFetch();
    } else {
      const user = await tryRefresh();
      if (user) res = await doFetch();
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = (text ? JSON.parse(text) : undefined) as T;
  if (method === "GET") void writeJson(CACHE_PREFIX + path, data);
  return data;
}

/* --------------------------------------------------------------------- auth */

export async function login(email: string, password: string): Promise<UserInfo> {
  await clearCachedData();
  const data = await api<AuthPayload>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  accessToken = data.accessToken;
  return data.user;
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<UserInfo> {
  await clearCachedData();
  const data = await api<AuthPayload>("/api/auth/register", {
    method: "POST",
    body: { username, email, password },
  });
  accessToken = data.accessToken;
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await send("/api/auth/logout", { method: "POST" });
  } catch {
    // Offline: the session outlives us server-side, but this device must
    // still forget the account it was showing.
  }
  accessToken = null;
  await clearCachedData();
}
