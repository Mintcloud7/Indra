import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../api/types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.setToken(token);
      api.get<User>('/auth/me')
        .then((data) => setUser(data))
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
          api.setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.post<{ token: string; user: User }>('/auth/login', { username, password });
    localStorage.setItem('token', response.token);
    setToken(response.token);
    setUser(response.user);
    api.setToken(response.token);
    return response.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    api.setToken(null);
  }, []);

  const hasPermission = useCallback((permission: string) => {
    if (!user) return false;
    const roleNames = (user.roles || []).map((r: any) => typeof r === 'string' ? r : r.name);
    if (roleNames.includes('ADMIN')) return true;
    return (user.permissions || []).includes(permission);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, hasPermission, isAuthenticated: !!user, isLoading }}>
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
