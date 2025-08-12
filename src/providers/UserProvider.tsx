"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User } from '../models/User';
import { fetchWithTimeout } from '../services/api';

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  checkAuth: () => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      setUser(data.user);
      localStorage.setItem('isLoggedIn', 'true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout');
      setUser(null);
      localStorage.removeItem('isLoggedIn');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to logout');
      throw err;
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const updatedUser = await response.json();
      setUser(updatedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = useCallback(async () => {
    if (!localStorage.getItem('isLoggedIn')) return;

    try {
      const data = await fetchWithTimeout('/api/auth/check');
      setUser(data.user);
    } catch {
      localStorage.removeItem('isLoggedIn');
      setUser(null);
    }
  }, []);

  const register = async (email: string, password: string, username: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
      });
      const data = await response.json();
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    const interval = setInterval(checkAuth, 300000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, [checkAuth]);

  return (
    <UserContext.Provider value={{ 
      user, loading, error, 
      login, logout, updateProfile,
      checkAuth, register
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};
