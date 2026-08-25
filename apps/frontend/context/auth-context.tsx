'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@finpilot/shared-types';
import { loginApi, signupApi, logoutApi, refreshApi, getMeApi, LoginInput, SignupInput } from '../lib/auth';

interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshSession = useCallback(async () => {
    try {
      setLoading(true);
      const data = await refreshApi();
      setUser(data.user);
      setAccessToken(data.tokens.accessToken);
    } catch {
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (input: LoginInput) => {
    const data = await loginApi(input);
    setUser(data.user);
    setAccessToken(data.tokens.accessToken);
  };

  const signup = async (input: SignupInput) => {
    const data = await signupApi(input);
    setUser(data.user);
    setAccessToken(data.tokens.accessToken);
  };

  const logout = async () => {
    try {
      if (accessToken) {
        await logoutApi(accessToken);
      }
    } catch {
      // Ignore logout API error if token expired
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        signup,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
