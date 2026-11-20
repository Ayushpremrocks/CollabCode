import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/clerk-react';
import api, { setTokenGetter, type TokenGetter } from '../services/api';

export interface AppUser {
  /** Local database id (0 until /users/me has loaded). */
  userId: number;
  /**
   * The backend's username for this user — the same value the server puts in chat
   * messages, presence and room ownership. Falls back to the email prefix until loaded.
   */
  username: string;
  /** Human-friendly name for display. */
  displayName: string;
  email: string;
  imageUrl: string;
  clerkUserId: string;
}

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  getToken: TokenGetter;
}

interface BackendMe {
  clerkUserId: string;
  id: number;
  username: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken: clerkGetToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [me, setMe] = useState<BackendMe | null>(null);

  const getToken = useCallback<TokenGetter>(
    (options) => clerkGetToken(options?.fresh ? { skipCache: true } : undefined),
    [clerkGetToken],
  );

  useEffect(() => {
    setTokenGetter(isSignedIn ? getToken : null);
  }, [getToken, isSignedIn]);

  const clerkUserId = clerkUser?.id;
  useEffect(() => {
    if (!isSignedIn || !clerkUserId) return;
    let cancelled = false;
    api.get<{ id: number; username: string }>('/users/me')
      .then((res) => {
        if (!cancelled) setMe({ clerkUserId, id: res.data.id, username: res.data.username });
      })
      .catch((err) => console.warn('[Auth] Could not load backend profile', err));
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, clerkUserId]);

  const user = useMemo<AppUser | null>(() => {
    if (!clerkUser) return null;
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? '';
    const backend = me && me.clerkUserId === clerkUser.id ? me : null;
    return {
      userId: backend?.id ?? 0,
      username: backend?.username ?? (email.split('@')[0] || 'user'),
      displayName: clerkUser.fullName || clerkUser.firstName || clerkUser.username || email.split('@')[0] || 'User',
      email,
      imageUrl: clerkUser.imageUrl ?? '',
      clerkUserId: clerkUser.id,
    };
  }, [clerkUser, me]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated: isSignedIn ?? false,
    loading: !isLoaded,
    logout: () => signOut(),
    getToken,
  }), [user, isSignedIn, isLoaded, signOut, getToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
