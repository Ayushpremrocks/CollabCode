import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authService } from '../services/authService';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../types';

interface AuthContextType {
  user: { userId: number; username: string; email: string } | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ userId: number; username: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage
    const savedUser = authService.getUser();
    const token = authService.getToken();
    if (savedUser && token) {
      setUser(savedUser);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const response: AuthResponse = await authService.login(data);
    authService.saveAuth(response);
    setUser({
      userId: response.userId,
      username: response.username,
      email: response.email,
    });
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response: AuthResponse = await authService.register(data);
    authService.saveAuth(response);
    setUser({
      userId: response.userId,
      username: response.username,
      email: response.email,
    });
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
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
