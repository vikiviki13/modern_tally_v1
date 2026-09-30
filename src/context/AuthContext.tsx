import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserDTO, TenantDTO, LoginPayload, RegisterPayload } from '../../shared/types/auth';
import { authClient } from '../services/authClient';

interface AuthContextType {
  user: UserDTO | null;
  tenant: TenantDTO | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [tenant, setTenant] = useState<TenantDTO | null>(null);
  const [token, setToken] = useState<string | null>(authClient.getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = async () => {
    const storedToken = authClient.getStoredToken();
    if (!storedToken) {
      setUser(null);
      setTenant(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await authClient.getMe();
      setUser(data.user);
      setTenant(data.tenant);
      setToken(storedToken);
      setError(null);
    } catch {
      // If token is invalid or expired, clear session
      authClient.setStoredToken(null);
      setUser(null);
      setTenant(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = async (payload: LoginPayload) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await authClient.login(payload);
      setToken(res.token);
      // Fetch full profile
      const current = await authClient.getMe();
      setUser(current.user);
      setTenant(current.tenant);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await authClient.register(payload);
      setToken(res.token);
      const current = await authClient.getMe();
      setUser(current.user);
      setTenant(current.tenant);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await authClient.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setTenant(null);
      setToken(null);
      setIsLoading(false);
    }
  };

  const switchTenant = async (tenantId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await authClient.switchTenant(tenantId);
      setToken(res.token);
      const current = await authClient.getMe();
      setUser(current.user);
      setTenant(current.tenant);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to switch tenant';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        error,
        login,
        register,
        logout,
        switchTenant,
        refreshSession,
        clearError,
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
