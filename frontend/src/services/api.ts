import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export type TokenGetter = (options?: { fresh?: boolean }) => Promise<string | null>;

interface ClerkGlobal {
  loaded?: boolean;
  session?: { getToken: (opts?: { skipCache?: boolean }) => Promise<string | null> } | null;
}

/**
 * Returns a Clerk session token. Uses the getter registered by AuthProvider and
 * falls back to the global Clerk instance, so requests fired by child components
 * before AuthProvider's effect has run still get a token.
 */
let registeredGetter: TokenGetter | null = null;

export function setTokenGetter(getter: TokenGetter | null): void {
  registeredGetter = getter;
}

export async function getSessionToken(options?: { fresh?: boolean }): Promise<string | null> {
  if (registeredGetter) return registeredGetter(options);
  const clerk = (window as unknown as { Clerk?: ClerkGlobal }).Clerk;
  if (!clerk?.loaded || !clerk.session) return null;
  return clerk.session.getToken(options?.fresh ? { skipCache: true } : undefined);
}

// ── "Server is waking up" notifications (Render free tier cold starts take 1–2 min) ──

const SLOW_REQUEST_MS = 6000;
const slowListeners = new Set<() => void>();
export function onSlowRequest(listener: () => void): () => void {
  slowListeners.add(listener);
  return () => slowListeners.delete(listener);
}

/** Fire-and-forget request that starts waking the backend while the user signs in. */
export function warmUpBackend(): void {
  fetch(`${API_BASE_URL}/health`, { method: 'GET', mode: 'cors' }).catch(() => {
    /* best effort */
  });
}

// ── Axios instance ──────────────────────────────────────────────────────────

type RetryableConfig = InternalAxiosRequestConfig & { _authRetried?: boolean; _slowTimer?: ReturnType<typeof setTimeout> };

const api = axios.create({
  baseURL: API_BASE_URL,
  // Generous: a cold Render instance can take ~2 minutes to answer, and the AI
  // debug agent runs several compile + Gemini round-trips.
  timeout: 180_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: RetryableConfig) => {
  const token = await getSessionToken({ fresh: config._authRetried === true });
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config._slowTimer = setTimeout(() => slowListeners.forEach((l) => l()), SLOW_REQUEST_MS);
  return config;
});

function clearSlowTimer(config: RetryableConfig | undefined) {
  if (config?._slowTimer) clearTimeout(config._slowTimer);
}

api.interceptors.response.use(
  (response) => {
    clearSlowTimer(response.config as RetryableConfig);
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    clearSlowTimer(config);

    if (error.response?.status === 401 && config) {
      // Clerk tokens live ~60 s. If the request sat in a cold-start queue the token
      // may have expired before the server checked it: retry once with a new one.
      if (!config._authRetried) {
        config._authRetried = true;
        return api(config);
      }
      const stillSignedIn = (await getSessionToken().catch(() => null)) !== null;
      if (!stillSignedIn && !window.location.pathname.startsWith('/login')) {
        const back = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/login?redirect=${back}`);
      }
      // Signed in but still rejected: the backend's CLERK_JWKS_URI does not match
      // this Clerk instance. Do NOT redirect (that caused a /login ⇄ /dashboard loop).
    }
    return Promise.reject(error);
  },
);

/** Extracts the user-facing message from an API error. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as AxiosError<{ error?: string }>;
  if (e?.response?.data?.error) return e.response.data.error;
  if (e?.response?.status === 401) return 'The server rejected your session. Please sign out and in again.';
  if (e?.response?.status === 429) return 'Too many requests. Please wait a minute and try again.';
  if (e?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (e?.code === 'ERR_NETWORK') return 'Cannot reach the server. It may be starting up — try again in a moment.';
  return fallback;
}

export default api;
