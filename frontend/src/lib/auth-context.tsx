'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSession, signOut as nextAuthSignOut } from 'next-auth/react';

interface User {
  id: number;
  email: string;
  first_name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      // 1. Check NextAuth session (Google/Apple)
      const session = await getSession();
      if (session && session.user) {
        setUser({
          id: 0,
          email: session.user.email || '',
          first_name: session.user.name?.split(' ')[0] || 'User',
        });
        setToken('oauth_token_active'); // Mock token to satisfy isAuthenticated logic
        setIsLoading(false);
        return;
      }

      // 2. Fallback to localStorage (Email/Password via FastAPI)
      const savedToken = localStorage.getItem('smartmeal_token');
      const savedUser = localStorage.getItem('smartmeal_user');
      if (savedToken && savedUser) {
        setToken(savedToken);
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          localStorage.removeItem('smartmeal_user');
        }
      }
      setIsLoading(false);
    };

    hydrate();
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('smartmeal_token', newToken);
    localStorage.setItem('smartmeal_user', JSON.stringify(newUser));
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('smartmeal_token');
    localStorage.removeItem('smartmeal_user');
    localStorage.removeItem('smartmeal_bio');
    // Clear NextAuth session if it exists (don't redirect yet)
    await nextAuthSignOut({ redirect: false });
    window.location.href = '/auth';
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, isAuthenticated: !!token && !!user, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
