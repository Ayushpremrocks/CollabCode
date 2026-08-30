import { createContext, useContext, useEffect, useCallback, type ReactNode } from 'react';
import {
  useAuth as useClerkAuth,
  useUser,
  useClerk,
} from '@clerk/clerk-react';
import { setClerkTokenGetter } from '../services/api';

interface AuthContextType {
  user: { userId: number; username: string; email: string } | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (data: unknown) => Promise<void>;
  register: (data: unknown) => Promise<void>;
  logout: () => void;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  // Stable reference to Clerk's getToken so the Axios interceptor always
  // calls the latest version without stale closures.
  const stableGetToken = useCallback(
    () => getToken(),
    [getToken]
  );

  useEffect(() => {
    setClerkTokenGetter(stableGetToken);
  }, [stableGetToken]);

  const user = clerkUser
    ? {
        userId: 0,
        username: clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User',
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: isSignedIn ?? false,
        loading: !isLoaded,
        login: async () => {},
        register: async () => {},
        logout: () => signOut(),
        getToken: stableGetToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
