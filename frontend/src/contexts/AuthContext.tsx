import { createContext, useContext, useEffect, type ReactNode } from 'react';
import {
  useAuth as useClerkAuth,
  useUser,
  useClerk,
} from '@clerk/clerk-react';
import { setClerkTokenGetter } from '../services/api';

// Keep the same interface shape so all consumers (Navbar, EditorPage, DashboardPage,
// ProtectedRoute, WebSocketContext, useCollaboration) require ZERO changes.
interface AuthContextType {
  user: { userId: number; username: string; email: string } | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** No-op — sign-in is handled by the Clerk <SignIn /> component on /login */
  login: (data: unknown) => Promise<void>;
  /** No-op — sign-up is handled by the Clerk <SignUp /> component on /register */
  register: (data: unknown) => Promise<void>;
  logout: () => void;
  /** Returns a fresh Clerk session token (async — may hit Clerk's API on expiry) */
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  // Register the token getter with the Axios instance so all HTTP requests get
  // a fresh Bearer token without any manual effort in each service file.
  useEffect(() => {
    setClerkTokenGetter(() => getToken());
  }, [getToken]);

  // Map Clerk user to the shape the rest of the app expects
  const user = clerkUser
    ? {
        userId: 0, // Clerk has no numeric ID; backend assigns one via auto-provisioning
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
        login: async () => {}, // Sign-in is handled by Clerk UI at /login
        register: async () => {}, // Sign-up is handled by Clerk UI at /register
        logout: () => signOut(),
        getToken: () => getToken(),
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
